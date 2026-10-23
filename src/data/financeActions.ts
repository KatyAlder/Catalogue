import { mutate } from './store'
import { round2 } from './finance'
import type { AccountKind, Audit, CollectionData, FinanceConfig, LocalDB, Operation, Snapshot } from './types'
import { uid } from './types'

export interface UpdateEntry {
  id: string
  amount: number
  currency: string
}

function colData(db: LocalDB, collectionId: string): CollectionData {
  const d = (db.collections[collectionId] ??= {
    id: collectionId,
    records: [],
    snapshots: [],
    deleted: {},
  })
  d.operations ??= []
  d.audits ??= []
  return d
}

/** «Зберегти оновлення»: нові суми в рахунках + знімок на дату.
    Знімок створюється лише цією явною дією. Знімок за ту саму дату замінюється.
    Кожна змінена сума стає в журналі операцією «зміна» (без категорії й питань). */
export function saveFinanceUpdate(
  collectionId: string,
  amountColumnId: string,
  date: string,
  entries: UpdateEntry[],
) {
  mutate(
    (db) => {
      const data = colData(db, collectionId)
      const t = Date.now()
      for (const e of entries) {
        const r = data.records.find((x) => x.id === e.id)
        if (!r) continue
        const before = typeof r.values[amountColumnId] === 'number' ? (r.values[amountColumnId] as number) : 0
        if (r.values[amountColumnId] !== e.amount) {
          r.values[amountColumnId] = e.amount
          r.updatedAt = t
        }
        const delta = round2(e.amount - before)
        if (delta !== 0) {
          data.operations!.push({
            id: uid(),
            date,
            type: 'adjust',
            accountId: e.id,
            amount: delta,
            currency: e.currency,
            updatedAt: t,
          })
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

/** Гаманець чи конверт. */
export function setAccountKind(collectionId: string, id: string, kind: AccountKind) {
  mutate(
    (db) => {
      const r = colData(db, collectionId).records.find((x) => x.id === id)
      if (!r) return
      if (kind === 'wallet') {
        r.kind = 'wallet'
        delete r.investment // гаманець не буває інвестицією
      } else delete r.kind
      r.updatedAt = Date.now()
    },
    [collectionId],
  )
}

/* ---------------- журнал операцій ---------------- */

export type NewOperation = Omit<Operation, 'id' | 'updatedAt'>

/** Застосувати (sign = 1) або скасувати (sign = −1) дію операції над залишками.
    «Зміна» вже застосована швидким оновленням, тому тут її не чіпаємо. */
function applyOp(db: LocalDB, data: CollectionData, op: NewOperation, sign: 1 | -1) {
  const col = db.index.collections.find((c) => c.id === data.id)?.finance?.amountColumnId
  if (!col || op.type === 'adjust') return
  const bump = (id: string | undefined, delta: number) => {
    const r = id ? data.records.find((x) => x.id === id) : undefined
    if (!r) return
    const cur = typeof r.values[col] === 'number' ? (r.values[col] as number) : 0
    r.values[col] = round2(cur + delta)
    r.updatedAt = Date.now()
  }
  if (op.type === 'income') bump(op.accountId, sign * op.amount)
  else {
    bump(op.fromId, -sign * op.amount)
    bump(op.toId, sign * (op.toAmount ?? op.amount))
  }
}

export function addOperation(collectionId: string, op: NewOperation) {
  mutate(
    (db) => {
      const data = colData(db, collectionId)
      applyOp(db, data, op, 1)
      data.operations!.push({ ...op, id: uid(), updatedAt: Date.now() })
    },
    [collectionId],
  )
}

/** Правка: стару дію скасовуємо, нову застосовуємо. */
export function updateOperation(collectionId: string, id: string, op: NewOperation) {
  mutate(
    (db) => {
      const data = colData(db, collectionId)
      const i = data.operations!.findIndex((o) => o.id === id)
      if (i < 0) return
      applyOp(db, data, data.operations![i], -1)
      applyOp(db, data, op, 1)
      data.operations![i] = { ...op, id, updatedAt: Date.now() }
    },
    [collectionId],
  )
}

/** Видалення надходження чи переказу повертає залишки; запис «зміна» лише зникає з історії. */
export function deleteOperation(collectionId: string, id: string) {
  mutate(
    (db) => {
      const data = colData(db, collectionId)
      const op = data.operations!.find((o) => o.id === id)
      if (!op) return
      applyOp(db, data, op, -1)
      data.operations = data.operations!.filter((o) => o.id !== id)
      data.deleted[id] = Date.now()
    },
    [collectionId],
  )
}

/* ---------------- квартальний аудит ---------------- */

export function saveAudit(collectionId: string, audit: Audit) {
  mutate(
    (db) => {
      const data = colData(db, collectionId)
      const i = data.audits!.findIndex((a) => a.id === audit.id)
      const next = { ...audit, updatedAt: Date.now() }
      if (i < 0) data.audits!.push(next)
      else data.audits![i] = next
    },
    [collectionId],
  )
}

export function deleteAudit(collectionId: string, id: string) {
  mutate(
    (db) => {
      const data = colData(db, collectionId)
      data.audits = data.audits!.filter((a) => a.id !== id)
      data.deleted[id] = Date.now()
    },
    [collectionId],
  )
}
