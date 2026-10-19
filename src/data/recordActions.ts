import { mutate } from './store'
import type { CellValue, CollectionData, LocalDB } from './types'
import { uid } from './types'

function data(db: LocalDB, collectionId: string): CollectionData {
  return (db.collections[collectionId] ??= {
    id: collectionId,
    records: [],
    snapshots: [],
    deleted: {},
  })
}

export function addRecord(collectionId: string, values: Record<string, CellValue>): string {
  const id = uid()
  const t = Date.now()
  mutate(
    (db) => {
      data(db, collectionId).records.push({ id, values, createdAt: t, updatedAt: t })
    },
    [collectionId],
  )
  return id
}

export function updateRecord(collectionId: string, id: string, values: Record<string, CellValue>) {
  mutate(
    (db) => {
      const r = data(db, collectionId).records.find((x) => x.id === id)
      if (r) {
        r.values = values
        r.updatedAt = Date.now()
      }
    },
    [collectionId],
  )
}

export function setCell(collectionId: string, id: string, colId: string, value: CellValue) {
  mutate(
    (db) => {
      const r = data(db, collectionId).records.find((x) => x.id === id)
      if (r) {
        r.values[colId] = value
        r.updatedAt = Date.now()
      }
    },
    [collectionId],
  )
}

export function deleteRecord(collectionId: string, id: string) {
  mutate(
    (db) => {
      const d = data(db, collectionId)
      d.records = d.records.filter((r) => r.id !== id)
      d.deleted[id] = Date.now()
    },
    [collectionId],
  )
}

export function duplicateRecord(collectionId: string, id: string): string | null {
  const newId = uid()
  let ok = false
  mutate(
    (db) => {
      const src = data(db, collectionId).records.find((r) => r.id === id)
      if (!src) return
      ok = true
      const t = Date.now()
      data(db, collectionId).records.push({
        ...structuredClone(src),
        id: newId,
        createdAt: t,
        updatedAt: t,
      })
    },
    [collectionId],
  )
  return ok ? newId : null
}
