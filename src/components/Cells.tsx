import type { CellValue, Column } from '../data/types'
import { formatDate } from '../data/view'

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/** Прогрес: смужка 0–100% з кнопками −/+ (крок із налаштувань стовпця). */
export function ProgressControl({
  value,
  step = 10,
  onChange,
}: {
  value: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="progress">
      <button type="button" className="icon-btn" onClick={() => onChange(clamp(value - step))} aria-label={`−${step}%`}>
        −
      </button>
      <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar-fill" style={{ width: `${value}%` }} />
        <span className="bar-text">{value}%</span>
      </div>
      <button type="button" className="icon-btn" onClick={() => onChange(clamp(value + step))} aria-label={`+${step}%`}>
        +
      </button>
    </div>
  )
}

/** Відображення значення клітинки (таблиця, плитка). */
export function CellView({
  col,
  value,
  onProgress,
}: {
  col: Column
  value: CellValue | undefined
  onProgress?: (v: number) => void
}) {
  if (col.type === 'progress') {
    const n = typeof value === 'number' ? value : 0
    return onProgress ? (
      <ProgressControl value={n} step={col.step} onChange={onProgress} />
    ) : (
      <span>{n}%</span>
    )
  }
  if (value === null || value === undefined || value === '') return <span className="muted">—</span>
  switch (col.type) {
    case 'select': {
      const o = col.options?.find((x) => x.id === value)
      if (!o) return <span className="muted">—</span>
      return (
        <span className="chip" style={{ background: o.color ?? '#8a8f99' }}>
          {o.label}
        </span>
      )
    }
    case 'checkbox':
      return <span>{value ? '✓' : '—'}</span>
    case 'link': {
      const href = /^https?:\/\//i.test(String(value)) ? String(value) : `https://${value}`
      return (
        <a href={href} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
          {String(value).replace(/^https?:\/\//i, '')}
        </a>
      )
    }
    case 'date':
      return <span>{formatDate(String(value))}</span>
    default:
      return <span>{String(value)}</span>
  }
}

/** Поле редагування значення (форма запису). */
export function CellInput({
  col,
  value,
  onChange,
}: {
  col: Column
  value: CellValue | undefined
  onChange: (v: CellValue) => void
}) {
  switch (col.type) {
    case 'number':
      return (
        <input
          type="number"
          inputMode="decimal"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )
    case 'date':
      return <input type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)} />
    case 'checkbox':
      return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
    case 'select':
      return (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {(col.options ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case 'progress':
      return <ProgressControl value={typeof value === 'number' ? value : 0} step={col.step} onChange={onChange} />
    case 'link':
      return (
        <input
          type="url"
          placeholder="https://"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )
    case 'photo':
      return <span className="muted">Фото з’явиться пізніше</span>
    default:
      return <input value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)} />
  }
}
