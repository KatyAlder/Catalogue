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
