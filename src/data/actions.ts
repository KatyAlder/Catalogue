import { mutate } from './store'
import type { CollectionMeta, LocalDB, Shelf } from './types'
import { uid } from './types'

export type CollectionDraft = Omit<CollectionMeta, 'id' | 'createdAt' | 'updatedAt'>

const INDEX = 'index'

function targetShelf(db: LocalDB, tracker: boolean): Shelf {
  const shelves = db.index.shelves
  const found = shelves.find((s) => !!s.isTrackerShelf === tracker)
  if (found) return found
  const shelf: Shelf = {
    id: uid(),
    name: tracker ? 'Трекери' : 'Полиця',
    collectionIds: [],
    isTrackerShelf: tracker || undefined,
    updatedAt: Date.now(),
  }
  shelves.push(shelf)
  return shelf
}

export function createCollection(draft: CollectionDraft): string {
  const id = uid()
  const t = Date.now()
  mutate(
    (db) => {
      db.index.collections.push({ ...draft, id, createdAt: t, updatedAt: t })
      const shelf = targetShelf(db, draft.module === 'tracker')
      shelf.collectionIds.push(id)
      shelf.updatedAt = t
      db.collections[id] = { id, records: [], snapshots: [], deleted: {} }
    },
    [INDEX, id],
  )
  return id
}

/** Модуль колекції після створення не змінюється. */
export function updateCollection(id: string, patch: CollectionDraft) {
  mutate((db) => {
    const c = db.index.collections.find((x) => x.id === id)
    if (!c) return
    Object.assign(c, patch, { module: c.module, updatedAt: Date.now() })
  })
}

export function deleteCollection(id: string) {
  mutate((db) => {
    const t = Date.now()
    db.index.collections = db.index.collections.filter((c) => c.id !== id)
    for (const s of db.index.shelves) {
      if (s.collectionIds.includes(id)) {
        s.collectionIds = s.collectionIds.filter((x) => x !== id)
        s.updatedAt = t
      }
    }
    db.index.deleted[id] = t
    delete db.collections[id]
  })
}

/** Копія як шаблон: структура стовпців, за бажанням із даними. */
export function cloneCollection(id: string, withData: boolean): string | null {
  const newId = uid()
  let ok = false
  mutate(
    (db) => {
      const src = db.index.collections.find((c) => c.id === id)
      if (!src) return
      ok = true
      const t = Date.now()
      const copy: CollectionMeta = {
        ...structuredClone(src),
        id: newId,
        name: `${src.name} (копія)`,
        createdAt: t,
        updatedAt: t,
      }
      db.index.collections.push(copy)
      const shelf =
        db.index.shelves.find((s) => s.collectionIds.includes(id)) ??
        targetShelf(db, src.module === 'tracker')
      shelf.collectionIds.push(newId)
      shelf.updatedAt = t
      const data = db.collections[id]
      db.collections[newId] = {
        id: newId,
        records:
          withData && data
            ? data.records.map((r) => ({ ...structuredClone(r), id: uid(), createdAt: t, updatedAt: t }))
            : [],
        snapshots: [],
        deleted: {},
      }
    },
    [INDEX, newId],
  )
  return ok ? newId : null
}

/* ---------------- полиці ---------------- */

const sortedShelves = (db: LocalDB) =>
  [...db.index.shelves].sort(
    (a, b) => (a.order ?? db.index.shelves.indexOf(a)) - (b.order ?? db.index.shelves.indexOf(b)),
  )

/** Перемістити колекцію на полицю; overId — колекція, перед якою вставити (null — у кінець). */
export function moveCollection(id: string, destShelfId: string, overId: string | null) {
  mutate((db) => {
    const shelves = db.index.shelves
    const src = shelves.find((s) => s.collectionIds.includes(id))
    const dest = shelves.find((s) => s.id === destShelfId)
    if (!src || !dest) return
    const from = src.collectionIds.indexOf(id)
    let to = overId ? dest.collectionIds.indexOf(overId) : -1
    if (to < 0) to = src === dest ? dest.collectionIds.length - 1 : dest.collectionIds.length
    src.collectionIds.splice(from, 1)
    dest.collectionIds.splice(to, 0, id)
    const t = Date.now()
    src.updatedAt = t
    dest.updatedAt = t
  })
}

/* Декор живе в тому самому списку полиці, що й колекції, з ідентифікатором
   d:<ключ>:<uid>. Так перетягування, порядок і синхронізація працюють без змін. */
export const DECOR_PREFIX = 'd:'
export const isDecorId = (id: string) => id.startsWith(DECOR_PREFIX)
export const decorKeyOf = (id: string) => id.split(':')[1] ?? ''

export function addDecor(shelfId: string, key: string) {
  mutate((db) => {
    const s = db.index.shelves.find((x) => x.id === shelfId)
    if (!s) return
    s.collectionIds.push(`${DECOR_PREFIX}${key}:${uid()}`)
    s.updatedAt = Date.now()
  })
}

export function removeDecor(id: string) {
  mutate((db) => {
    const t = Date.now()
    for (const s of db.index.shelves) {
      if (s.collectionIds.includes(id)) {
        s.collectionIds = s.collectionIds.filter((x) => x !== id)
        s.updatedAt = t
      }
    }
  })
}

export function addShelf(name: string) {
  mutate((db) => {
    const max = Math.max(-1, ...sortedShelves(db).map((s, i) => s.order ?? i))
    db.index.shelves.push({
      id: uid(),
      name: name || 'Нова полиця',
      collectionIds: [],
      order: max + 1,
      updatedAt: Date.now(),
    })
  })
}

export function renameShelf(id: string, name: string) {
  mutate((db) => {
    const s = db.index.shelves.find((x) => x.id === id)
    if (s) {
      s.name = name
      s.updatedAt = Date.now()
    }
  })
}

/** Видаляється лише порожня полиця. */
export function deleteShelf(id: string) {
  mutate((db) => {
    const s = db.index.shelves.find((x) => x.id === id)
    if (!s || s.collectionIds.length) return
    db.index.shelves = db.index.shelves.filter((x) => x.id !== id)
    db.index.deleted[id] = Date.now()
  })
}

export function moveShelf(id: string, dir: -1 | 1) {
  mutate((db) => {
    const list = sortedShelves(db)
    const i = list.findIndex((s) => s.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    const t = Date.now()
    list.forEach((s, k) => {
      if (s.order !== k) {
        s.order = k
        s.updatedAt = t
      }
    })
  })
}

export function setShowShelfNames(show: boolean) {
  mutate((db) => {
    db.index.settings = { showShelfNames: show, updatedAt: Date.now() }
  })
}
