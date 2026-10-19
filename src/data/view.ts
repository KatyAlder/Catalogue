import type { CellValue, Column, RecordItem } from './types'

export interface ViewState {
  search: string
  /** colId -> значення фільтра: id варіанта (select) або 'yes' / 'no' (checkbox) */
  filters: Record<string, string>
  sortCol: string
  sortDir: 'asc' | 'desc'
  groupCol: string
}

export const emptyView = (): ViewState => ({
  search: '',
  filters: {},
  sortCol: '',
  sortDir: 'asc',
  groupCol: '',
})

export const isFilterable = (c: Column) => c.type === 'select' || c.type === 'checkbox'

export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

/** Текстове представлення значення: для пошуку, сортування та групування. */
export function cellText(col: Column, v: CellValue | undefined): string {
  if (v === null || v === undefined || v === '') return ''
  switch (col.type) {
    case 'select':
      return col.options?.find((o) => o.id === v)?.label ?? ''
    case 'checkbox':
      return v ? 'Так' : 'Ні'
    case 'progress':
      return `${v}%`
    case 'date':
      return formatDate(String(v))
    default:
      return String(v)
  }
}

export function recordTitle(columns: Column[], r: RecordItem): string {
  for (const c of columns) {
    if (c.type === 'text' || c.type === 'select' || c.type === 'link') {
      const t = cellText(c, r.values[c.id])
      if (t) return t
    }
  }
  return 'Без назви'
}

function compare(col: Column, a: RecordItem, b: RecordItem): number {
  const va = a.values[col.id]
  const vb = b.values[col.id]
  const ea = va === null || va === undefined || va === ''
  const eb = vb === null || vb === undefined || vb === ''
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1 // порожні в кінець
  if (col.type === 'number' || col.type === 'progress') return Number(va) - Number(vb)
  if (col.type === 'checkbox') return Number(!!va) - Number(!!vb)
  if (col.type === 'date') return String(va).localeCompare(String(vb))
  if (col.type === 'select') {
    const ids = col.options?.map((o) => o.id) ?? []
    return ids.indexOf(String(va)) - ids.indexOf(String(vb))
  }
  return cellText(col, va).localeCompare(cellText(col, vb), 'uk')
}

export function filterRecords(columns: Column[], records: RecordItem[], v: ViewState): RecordItem[] {
  const q = v.search.trim().toLowerCase()
  return records.filter((r) => {
    for (const [colId, fv] of Object.entries(v.filters)) {
      if (!fv) continue
      const col = columns.find((c) => c.id === colId)
      if (!col) continue
      const val = r.values[colId]
      if (col.type === 'checkbox') {
        if (fv === 'yes' ? !val : !!val) return false
      } else if (val !== fv) return false
    }
    if (q) {
      return columns.some((c) => cellText(c, r.values[c.id]).toLowerCase().includes(q))
    }
    return true
  })
}

export interface Group {
  key: string
  label: string
  records: RecordItem[]
}

export function buildGroups(columns: Column[], records: RecordItem[], v: ViewState): Group[] {
  let list = filterRecords(columns, records, v)
  const sortCol = columns.find((c) => c.id === v.sortCol)
  if (sortCol) {
    const dir = v.sortDir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      const ea = a.values[sortCol.id] === null || a.values[sortCol.id] === undefined || a.values[sortCol.id] === ''
      const eb = b.values[sortCol.id] === null || b.values[sortCol.id] === undefined || b.values[sortCol.id] === ''
      // порожні завжди в кінці незалежно від напрямку
      if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1
      return compare(sortCol, a, b) * dir
    })
  }
  const groupCol = columns.find((c) => c.id === v.groupCol)
  if (!groupCol) return [{ key: '', label: '', records: list }]

  const map = new Map<string, Group>()
  for (const r of list) {
    const label = cellText(groupCol, r.values[groupCol.id]) || '—'
    const g = map.get(label) ?? { key: label, label, records: [] }
    g.records.push(r)
    map.set(label, g)
  }
  const groups = [...map.values()]
  if (groupCol.type === 'select') {
    const order = groupCol.options?.map((o) => o.label) ?? []
    groups.sort((a, b) => {
      const ia = order.indexOf(a.label)
      const ib = order.indexOf(b.label)
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
    })
  } else {
    groups.sort((a, b) => (a.label === '—' ? 1 : b.label === '—' ? -1 : a.label.localeCompare(b.label, 'uk')))
  }
  return groups
}
