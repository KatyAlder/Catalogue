import { useState } from 'react'
import type { CollectionDraft } from '../data/actions'
import type { Column, ColumnType, SelectOption } from '../data/types'
import { uid } from '../data/types'
import { ICONS } from '../icons'

const TYPE_LABELS: Record<ColumnType, string> = {
  text: 'Текст',
  number: 'Число',
  select: 'Випадаючий список',
  checkbox: 'Чекбокс',
  link: 'Посилання',
  date: 'Дата',
  progress: 'Прогрес у %',
  photo: 'Фото (скоро)',
}
const SELECTABLE: ColumnType[] = ['text', 'number', 'select', 'checkbox', 'link', 'date', 'progress']

const PALETTE = ['#6fae6a', '#e0b84a', '#d9695a', '#8a8f99', '#5a8fd9', '#b377d1']

const defaultStatusOptions = (): SelectOption[] => [
  { id: uid(), label: 'Зроблено', color: PALETTE[0] },
  { id: uid(), label: 'Частково', color: PALETTE[1] },
  { id: uid(), label: 'Пропустила', color: PALETTE[2] },
  { id: uid(), label: 'План', color: PALETTE[3] },
]

interface Props {
  /** Початкові значення; у режимі редагування — поточна колекція */
  initial?: CollectionDraft
  mode: 'create' | 'edit'
  onSave: (draft: CollectionDraft) => void
  onCancel: () => void
}

export default function CollectionForm({ initial, mode, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? 'box')
  const [isTracker, setIsTracker] = useState(initial?.module === 'tracker')
  const [columns, setColumns] = useState<Column[]>(initial?.columns ?? [])
  const [dateCol, setDateCol] = useState(initial?.tracker?.dateColumnId ?? '')
  const [statusCol, setStatusCol] = useState(initial?.tracker?.statusColumnId ?? '')
  const [error, setError] = useState('')

  const patchCol = (id: string, patch: Partial<Column>) =>
    setColumns((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const addColumn = () =>
    setColumns((cs) => [...cs, { id: uid(), name: '', type: 'text' }])

  const move = (i: number, d: -1 | 1) =>
    setColumns((cs) => {
      const j = i + d
      if (j < 0 || j >= cs.length) return cs
      const next = [...cs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const changeType = (c: Column, type: ColumnType) => {
    const patch: Partial<Column> = { type }
    if (type === 'select' && !c.options?.length) patch.options = []
    if (type === 'progress' && !c.step) patch.step = 10
    patchCol(c.id, patch)
  }

  const toggleTracker = (on: boolean) => {
    setIsTracker(on)
    if (!on) return
    // підставити стандартні стовпці, якщо потрібних типів ще немає
    setColumns((cs) => {
      let next = cs
      let d = next.find((c) => c.type === 'date')
      let s = next.find((c) => c.type === 'select')
      if (!d) {
        d = { id: uid(), name: 'Дата', type: 'date' }
        next = [...next, d]
      }
      if (!s) {
        s = { id: uid(), name: 'Статус', type: 'select', options: defaultStatusOptions() }
        next = [...next, s]
      }
      setDateCol(d.id)
      setStatusCol(s.id)
      return next
    })
  }

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('Дай колекції назву')
    if (!columns.length) return setError('Додай хоча б один стовпець')
    if (columns.some((c) => !c.name.trim())) return setError('У кожного стовпця має бути назва')
    for (const c of columns) {
      if (c.type === 'select' && (c.options ?? []).some((o) => !o.label.trim()))
        return setError(`У списку «${c.name}» є варіант без назви`)
    }
    if (isTracker) {
      const d = columns.find((c) => c.id === dateCol)
      const s = columns.find((c) => c.id === statusCol)
      if (d?.type !== 'date') return setError('Для календаря обери стовпець із датою')
      if (s?.type !== 'select' || !s.options?.length)
        return setError('Для календаря обери стовпець-список із варіантами статусів')
      if (s.options.some((o) => !o.color)) return setError('Кожному статусу потрібен колір')
    }
    onSave({
      name: trimmed,
      icon,
      module: isTracker ? 'tracker' : 'none',
      columns: columns.map((c) => ({ ...c, name: c.name.trim() })),
      tracker: isTracker ? { dateColumnId: dateCol, statusColumnId: statusCol } : undefined,
      finance: initial?.finance,
    })
  }

  const dateCols = columns.filter((c) => c.type === 'date')
  const selectCols = columns.filter((c) => c.type === 'select')

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label className="field">
        <span>Назва</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>

      <div className="field">
        <span>Іконка</span>
        <div className="icon-pick">
          {Object.entries(ICONS).map(([key, v]) => (
            <button
              type="button"
              key={key}
              title={v.label}
              className={icon === key ? 'active' : ''}
              onClick={() => setIcon(key)}
            >
              {v.glyph}
            </button>
          ))}
        </div>
      </div>

      {mode === 'create' && (
        <label className="check">
          <input type="checkbox" checked={isTracker} onChange={(e) => toggleTracker(e.target.checked)} />
          <span>
            Піксельний календар (для трекерів: дата + статус із кольорами). Увімкнути можна лише
            тепер, при створенні.
          </span>
        </label>
      )}

      <h3>Стовпці</h3>
      {columns.map((c, i) => (
        <div className="col-row" key={c.id}>
          <div className="col-main">
            <input
              placeholder="Назва стовпця"
              value={c.name}
              onChange={(e) => patchCol(c.id, { name: e.target.value })}
            />
            <select
              value={c.type}
              disabled={mode === 'edit' && !!initial?.columns.some((x) => x.id === c.id)}
              title={mode === 'edit' ? 'Тип існуючого стовпця змінити не можна' : ''}
              onChange={(e) => changeType(c, e.target.value as ColumnType)}
            >
              {SELECTABLE.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <button type="button" className="icon-btn" onClick={() => move(i, -1)} aria-label="Вгору">
              ↑
            </button>
            <button type="button" className="icon-btn" onClick={() => move(i, 1)} aria-label="Вниз">
              ↓
            </button>
            <button
              type="button"
              className="icon-btn danger"
              onClick={() => setColumns((cs) => cs.filter((x) => x.id !== c.id))}
              aria-label="Видалити стовпець"
            >
              ✕
            </button>
          </div>

          {c.type === 'progress' && (
            <label className="inline">
              Крок, %
              <input
                type="number"
                min={1}
                max={100}
                value={c.step ?? 10}
                onChange={(e) => patchCol(c.id, { step: Math.max(1, Math.min(100, Number(e.target.value) || 10)) })}
              />
            </label>
          )}

          {c.type === 'select' && (
            <div className="options">
              {(c.options ?? []).map((o) => (
                <div className="opt" key={o.id}>
                  <input
                    type="color"
                    value={o.color ?? '#8a8f99'}
                    onChange={(e) =>
                      patchCol(c.id, {
                        options: c.options!.map((x) => (x.id === o.id ? { ...x, color: e.target.value } : x)),
                      })
                    }
                    aria-label="Колір варіанта"
                  />
                  <input
                    placeholder="Варіант"
                    value={o.label}
                    onChange={(e) =>
                      patchCol(c.id, {
                        options: c.options!.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => patchCol(c.id, { options: c.options!.filter((x) => x.id !== o.id) })}
                    aria-label="Видалити варіант"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn ghost small"
                onClick={() =>
                  patchCol(c.id, {
                    options: [
                      ...(c.options ?? []),
                      { id: uid(), label: '', color: PALETTE[(c.options?.length ?? 0) % PALETTE.length] },
                    ],
                  })
                }
              >
                + Варіант
              </button>
            </div>
          )}
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={addColumn}>
        + Стовпець
      </button>

      {isTracker && (
        <div className="tracker-cfg">
          <h3>Календар</h3>
          <label className="field">
            <span>Стовпець із датою</span>
            <select value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
              <option value="">—</option>
              {dateCols.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || '(без назви)'}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Стовпець зі статусом</span>
            <select value={statusCol} onChange={(e) => setStatusCol(e.target.value)}>
              <option value="">—</option>
              {selectCols.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || '(без назви)'}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn">
          {mode === 'create' ? 'Створити' : 'Зберегти'}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Скасувати
        </button>
      </div>
    </form>
  )
}
