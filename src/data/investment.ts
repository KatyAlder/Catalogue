import type { Investment } from './types'

/* Розрахунок очікуваного доходу інвестиції/депозиту. Усі цифри приблизні:
   без податків, комісій і реальних правил банку.
   Прості відсотки: P·r·n/12. Складні: щомісячна капіталізація, P·((1+r/12)^n − 1). */

const DAY = 86400000

const parse = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const toISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Додати місяці з обрізанням дня (31 січня + 1 міс = 28/29 лютого). */
export function addMonths(iso: string, months: number): string {
  const d = parse(iso)
  const day = d.getDate()
  const r = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, last))
  return toISO(r)
}

const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY)

export type InvestStatus = 'upcoming' | 'active' | 'finished'

export interface InvestmentResult {
  endDate: string
  status: InvestStatus
  /** Очікуваний дохід за весь строк */
  expected: number
  /** Нараховано на сьогодні (пропорційно дням) */
  accrued: number
  daysLeft: number
}

export function isValidInvestment(inv: Investment | undefined | null): inv is Investment {
  return !!inv && inv.termMonths > 0 && /^\d{4}-\d{2}-\d{2}$/.test(inv.startDate) && Number.isFinite(inv.annualRate)
}

export function calcInvestment(inv: Investment, principal: number, today: Date): InvestmentResult {
  const r = inv.annualRate / 100
  const n = inv.termMonths
  const gain = (months: number) =>
    inv.compound ? principal * (Math.pow(1 + r / 12, months) - 1) : (principal * r * months) / 12

  const start = parse(inv.startDate)
  const endDate = addMonths(inv.startDate, n)
  const end = parse(endDate)
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const totalDays = Math.max(1, daysBetween(start, end))
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(start, t)))
  const status: InvestStatus = t < start ? 'upcoming' : t >= end ? 'finished' : 'active'

  return {
    endDate,
    status,
    expected: gain(n),
    accrued: gain((n * elapsed) / totalDays),
    daysLeft: Math.max(0, daysBetween(t, end)),
  }
}
