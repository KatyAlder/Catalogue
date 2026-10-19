import type { CollectionData, IndexData } from './types'

type Item = { id: string; updatedAt: number }

function mergeById<T extends Item>(
  local: T[],
  remote: T[],
  deleted: Record<string, number>,
): T[] {
  const map = new Map<string, T>()
  for (const r of remote) map.set(r.id, r)
  for (const l of local) {
    const ex = map.get(l.id)
    if (!ex || l.updatedAt > ex.updatedAt) map.set(l.id, l)
  }
  for (const id of Object.keys(deleted)) map.delete(id)
  return [...map.values()]
}

const mergeDeleted = (a: Record<string, number>, b: Record<string, number>) => ({
  ...a,
  ...b,
})

export function mergeIndex(local: IndexData, remote: IndexData): IndexData {
  const deleted = mergeDeleted(remote.deleted, local.deleted)
  return {
    version: 1,
    shelves: mergeById(local.shelves, remote.shelves, deleted),
    collections: mergeById(local.collections, remote.collections, deleted),
    settings:
      local.settings.updatedAt >= remote.settings.updatedAt
        ? local.settings
        : remote.settings,
    deleted,
  }
}

export function mergeCollection(
  local: CollectionData,
  remote: CollectionData,
): CollectionData {
  const deleted = mergeDeleted(remote.deleted, local.deleted)
  return {
    id: local.id,
    records: mergeById(local.records, remote.records, deleted),
    snapshots: mergeById(local.snapshots, remote.snapshots, deleted),
    deleted,
  }
}
