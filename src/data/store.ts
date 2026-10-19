import { useSyncExternalStore } from 'react'
import { AuthExpiredError, CLIENT_ID, initAuth, signIn, signOut, wasSignedIn } from '../auth/google'
import { driveCreate, driveFind, driveLoad, driveUpload } from './drive'
import { mergeCollection, mergeIndex } from './merge'
import type { CollectionData, IndexData, LocalDB } from './types'
import { uid } from './types'

/* Локальна копія даних + синхронізація з Google Drive.
   Drive: shafa-index.json (шафа, колекції, налаштування) і shafa-col-<id>.json
   на кожну колекцію. Без входу додаток працює локально. */

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error' | 'needs-auth'

export interface AppState {
  db: LocalDB
  status: SyncStatus
  signedIn: boolean
  message: string
}

const DB_KEY = 'shafa-db-v1'
const IDS_KEY = 'shafa-drive-ids-v1'
const DIRTY_KEY = 'shafa-dirty-v1'
const INDEX = 'index'

const now = () => Date.now()

function emptyIndex(): IndexData {
  const t = now()
  return {
    version: 1,
    shelves: [
      { id: uid(), name: 'Полиця 1', collectionIds: [], updatedAt: t },
      { id: uid(), name: 'Трекери', collectionIds: [], isTrackerShelf: true, updatedAt: t },
    ],
    collections: [],
    settings: { showShelfNames: false, updatedAt: t },
    deleted: {},
  }
}

const emptyCollection = (id: string): CollectionData => ({
  id,
  records: [],
  snapshots: [],
  deleted: {},
})

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ліміт або приватний режим */
  }
}

let driveIds: Record<string, string> = readLS(IDS_KEY, {})
let dirty = new Set<string>(readLS<string[]>(DIRTY_KEY, []))

let state: AppState = {
  db: readLS<LocalDB>(DB_KEY, { index: emptyIndex(), collections: {} }),
  status: wasSignedIn() ? 'syncing' : 'local',
  signedIn: wasSignedIn(),
  message: '',
}

const listeners = new Set<() => void>()
function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const persist = () => {
  writeLS(DB_KEY, state.db)
  writeLS(DIRTY_KEY, [...dirty])
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

/** Змінити дані: fn отримує копію, dirtyKeys — які файли Drive змінились. */
export function mutate(fn: (db: LocalDB) => void, dirtyKeys: string[] = [INDEX]) {
  const db = structuredClone(state.db)
  fn(db)
  dirtyKeys.forEach((k) => dirty.add(k))
  setState({ db })
  persist()
  scheduleSync()
}

export const getCollectionData = (db: LocalDB, id: string): CollectionData =>
  db.collections[id] ?? emptyCollection(id)

/* ---------------- синхронізація ---------------- */

let timer: ReturnType<typeof setTimeout> | undefined
function scheduleSync() {
  if (!state.signedIn) return
  clearTimeout(timer)
  timer = setTimeout(() => void syncDirty(), 1500)
}

const fileName = (key: string) => (key === INDEX ? 'shafa-index.json' : `shafa-col-${key}.json`)

async function ensureFileId(key: string): Promise<string | null> {
  if (driveIds[key]) return driveIds[key]
  const f = await driveFind(fileName(key))
  if (f) {
    driveIds[key] = f.id
    writeLS(IDS_KEY, driveIds)
    return f.id
  }
  return null
}

async function syncKey(db: LocalDB, key: string): Promise<LocalDB> {
  const id = await ensureFileId(key)
  if (key === INDEX) {
    const remote = id ? await driveLoad<IndexData>(id) : null
    const merged = remote ? mergeIndex(db.index, remote) : db.index
    await upload(key, id, merged)
    return { ...db, index: merged }
  }
  const local = db.collections[key] ?? emptyCollection(key)
  const remote = id ? await driveLoad<CollectionData>(id) : null
  const merged = remote ? mergeCollection(local, remote) : local
  await upload(key, id, merged)
  return { ...db, collections: { ...db.collections, [key]: merged } }
}

async function upload(key: string, id: string | null, content: unknown) {
  if (id) {
    await driveUpload(id, content)
  } else {
    const f = await driveCreate(fileName(key), content)
    driveIds[key] = f.id
    writeLS(IDS_KEY, driveIds)
  }
}

function handleSyncError(e: unknown) {
  if (e instanceof AuthExpiredError) {
    setState({ status: 'needs-auth', message: 'Сесія Google протухла — увійдіть знову' })
  } else {
    console.error('sync failed', e instanceof Error ? e.message : 'unknown')
    setState({ status: 'error', message: 'Не вдалося синхронізувати. Спробуємо ще раз' })
  }
}

let running = false
async function runSync(keys: string[]) {
  if (running || !state.signedIn) return
  running = true
  setState({ status: 'syncing', message: '' })
  try {
    let db = structuredClone(state.db)
    for (const key of keys) {
      db = await syncKey(db, key)
      dirty.delete(key)
    }
    setState({ db, status: 'synced' })
    persist()
  } catch (e) {
    handleSyncError(e)
  } finally {
    running = false
  }
}

/** Лише змінені файли. */
async function syncDirty() {
  if (dirty.size) await runSync([...dirty])
  else if (state.status === 'syncing') setState({ status: 'synced' })
}

/** Повна синхронізація після входу: індекс, потім усі колекції. */
async function fullSync() {
  await runSync([INDEX])
  if (state.status !== 'synced') return
  const ids = state.db.index.collections.map((c) => c.id)
  await runSync(ids)
}

/* ---------------- вхід / вихід ---------------- */

export async function startApp() {
  if (!CLIENT_ID) {
    setState({ status: 'local', message: 'Google Client ID не налаштовано — працюємо локально' })
    return
  }
  try {
    await initAuth()
  } catch {
    setState({ status: 'error', message: 'Не вдалося завантажити Google вхід' })
    return
  }
  if (wasSignedIn()) {
    dirty.add(INDEX)
    await fullSync()
  }
}

export async function doSignIn() {
  try {
    await signIn()
    setState({ signedIn: true, status: 'syncing', message: '' })
    dirty.add(INDEX)
    await fullSync()
  } catch {
    setState({ status: 'error', message: 'Вхід не вдався' })
  }
}

export function doSignOut() {
  signOut()
  // ізоляція даних: на спільному пристрої локальна копія не має дістатись іншому акаунту
  driveIds = {}
  dirty = new Set()
  writeLS(IDS_KEY, driveIds)
  setState({
    db: { index: emptyIndex(), collections: {} },
    signedIn: false,
    status: 'local',
    message: '',
  })
  persist()
}
