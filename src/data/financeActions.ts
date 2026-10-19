import { mutate } from './store'
import type { FinanceConfig, Snapshot } from './types'
import { uid } from './types'

export interface UpdateEntry {
  id: string
  amount: number
  currency: string
}

/** «Зберегти оновлення»: нові суми в конвертах + знімок на дату.
    Знімок створюється лише цією явною дією. Знімок за ту саму дату замінюється. */
export function saveFinanceUpdate(
  collectionId: string,
  amountColumnId: string,
  date: string,
  entries: UpdateEntry[],
) {
  mutate(
    (db) => {
      const data = (db.collections[collectionId] ??= {
        id: collectionId,
        records: [],
        snapshots: [],
        deleted: {},
      })
      const t = Date.now()
      for (const e of entries) {
        const r = data.records.find((x) => x.id === e.id)
        if (r && r.values[amountColumnId] !== e.amount) {
          r.values[amountColumnId] = e.amount
          r.updatedAt = t
        }
      }
      const amounts: Record<string, number> = {}
      const currencies: Record<string, string> = {}
      for (const e of entries) {
        amounts[e.id] = e.amount
        currencies[e.id] = e.currency
      }
      const existing = data.snapshots.find((s) => s.date === date)
      if (existing) {
        existing.amounts = amounts
        existing.currencies = currencies
        existing.updatedAt = t
      } else {
        const snap: Snapshot = { id: uid(), date, amounts, currencies, updatedAt: t }
        data.snapshots.push(snap)
      }
    },
    [collectionId],
  )
}

export function updateFinanceConfig(collectionId: string, patch: Partial<FinanceConfig>) {
  mutate((db) => {
    const c = db.index.collections.find((x) => x.id === collectionId)
    if (c?.finance) {
      c.finance = { ...c.finance, ...patch }
      c.updatedAt = Date.now()
    }
  })
}
