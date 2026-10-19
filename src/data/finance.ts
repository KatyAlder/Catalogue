import type { CollectionMeta, RecordItem, Snapshot } from './types'

export interface Envelope {
  record: RecordItem
  name: string
  currency: string
  amount: number
}

/** Код валюти — підпис вибраного варіанта у стовпці валюти. */
export function envelopesOf(c: CollectionMeta, records: RecordItem[]): Envelope[] {
  const f = c.finance
  if (!f) return []
  const nameCol = c.columns.find((x) => x.id === f.nameColumnId)
  const curCol = c.columns.find((x) => x.id === f.currencyColumnId)
  return records.map((record) => {
    const rawName = record.values[f.nameColumnId]
    const cur = curCol?.options?.find((o) => o.id === record.values[f.currencyColumnId])?.label ?? ''
    const amt = record.values[f.amountColumnId]
    return {
      record,
      name: nameCol && rawName ? String(rawName) : 'Без назви',
      currency: cur,
      amount: typeof amt === 'number' ? amt : 0,
    }
  })
}

/** Курс до базової валюти; undefined — курс не задано. */
export function rateOf(code: string, base: string, rates: Record<string, number>): number | undefined {
  if (!code || code === base) return 1
  const r = rates[code]
  return r && r > 0 ? r : undefined
}

export interface Totals {
  byCurrency: Record<string, number>
  /** Приблизна сума в базовій валюті (лише валюти з відомим курсом) */
  approx: number
  /** Валюти, для яких не задано курс */
  missing: string[]
}

export function totalsOf(items: { currency: string; amount: number }[], base: string, rates: Record<string, number>): Totals {
  const byCurrency: Record<string, number> = {}
  const missing = new Set<string>()
  let approx = 0
  for (const it of items) {
    const code = it.currency || base
    byCurrency[code] = (byCurrency[code] ?? 0) + it.amount
    const r = rateOf(code, base, rates)
    if (r === undefined) missing.add(code)
    else approx += it.amount * r
  }
  return { byCurrency, approx, missing: [...missing] }
}

export const fmtMoney = (n: number) =>
  n.toLocaleString('uk-UA', { maximumFractionDigits: 2 })

export const todayISO = () => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export function lastSnapshotDate(snapshots: Snapshot[]): string | null {
  return snapshots.reduce<string | null>((m, s) => (!m || s.date > m ? s.date : m), null)
}

/** Скільки повних днів минуло від дати (YYYY-MM-DD) до сьогодні. */
export function daysSince(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const then = new Date(y, m - 1, d).getTime()
  const t = new Date()
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  return Math.max(0, Math.round((today - then) / 86400000))
}

export function agoText(date: string): string {
  const n = daysSince(date)
  if (n === 0) return 'оновлено сьогодні'
  if (n === 1) return 'оновлено вчора'
  return `оновлено ${n} дн. тому`
}
