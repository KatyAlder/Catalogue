import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { addRecord, deleteRecord } from '../data/recordActions'
import type { CollectionMeta, RecordItem, SelectOption } from '../data/types'
import { formatDate } from '../data/view'

/* Піксельний календар. Логіка перенесена з попереднього додатка:
   - рік (12×31) і місяць;
   - до двох відміток на день; з двома квадрат ділиться діагоналлю навпіл;
   - клік по дню відкриває день; наведення + цифра 1–9 швидко ставить/знімає статус. */

const MAX_MARKS = 2
const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']
const MONTHS_AB = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']
const WDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
const todayISO = () => {
  const t = new Date()
  return iso(t.getFullYear(), t.getMonth(), t.getDate())
}

interface Props {
  collection: CollectionMeta
  records: RecordItem[]
}

export default function TrackerCalendar({ collection, records }: Props) {
  const cfg = collection.tracker!
  const statusCol = collection.columns.find((c) => c.id === cfg.statusColumnId)
  const options: SelectOption[] = statusCol?.options ?? []

  const [mode, setMode] = useState<'month' | 'year'>('month')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const hover = useRef<string | null>(null)

  // відмітки по днях, у порядку створення
  const byDay = useMemo(() => {
    const map = new Map<string, RecordItem[]>()
    for (const r of records) {
      const d = r.values[cfg.dateColumnId]
      if (typeof d !== 'string' || !d) continue
      map.set(d, [...(map.get(d) ?? []), r])
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt - b.createdAt)
    return map
  }, [records, cfg.dateColumnId])

  const colorOf = (r: RecordItem) =>
    options.find((o) => o.id === r.values[cfg.statusColumnId])?.color ?? '#8a8f99'

  const pixelStyle = (day: string): React.CSSProperties => {
    const marks = byDay.get(day) ?? []
    if (!marks.length) return {}
    const c1 = colorOf(marks[0])
    if (marks.length === 1) return { background: c1 }
    return { background: `linear-gradient(135deg, ${c1} 0 50%, ${colorOf(marks[1])} 50% 100%)` }
  }

  const say = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 2500)
  }

  const addMark = (day: string, opt: SelectOption) => {
    const marks = byDay.get(day) ?? []
    if (marks.length >= MAX_MARKS) return say('На один день — не більше двох відміток')
    addRecord(collection.id, { [cfg.dateColumnId]: day, [cfg.statusColumnId]: opt.id })
  }

  /** Швидка відмітка: повторне натискання знімає «чисту» відмітку цього статусу. */
  const quickToggle = (day: string, opt: SelectOption) => {
    const marks = byDay.get(day) ?? []
    const existing = marks.find((r) => r.values[cfg.statusColumnId] === opt.id)
    if (existing) {
      const bare = Object.entries(existing.values).every(
        ([k, v]) => k === cfg.dateColumnId || k === cfg.statusColumnId || v === null || v === '' || v === undefined,
      )
      if (bare) {
        deleteRecord(collection.id, existing.id)
        say(`${formatDate(day)} — «${opt.label}» прибрано`)
      } else say('У цієї відмітки є деталі — відкрий день, щоб змінити')
      return
    }
    addMark(day, opt)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (!hover.current || openDay) return
      const n = Number(e.key)
      if (!n || n < 1 || n > 9 || !options[n - 1]) return
      e.preventDefault()
      quickToggle(hover.current, options[n - 1])
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const prev = () => {
    if (mode === 'year') return setYear((y) => y - 1)
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else setMonth((m) => m - 1)
  }
  const next = () => {
    if (mode === 'year') return setYear((y) => y + 1)
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else setMonth((m) => m + 1)
  }

  const today = todayISO()
  const dayProps = (day: string) => ({
    'data-day': day,
    onClick: () => setOpenDay(day),
    onMouseEnter: () => (hover.current = day),
    onMouseLeave: () => {
      if (hover.current === day) hover.current = null
    },
  })

  const dayMarks = openDay ? (byDay.get(openDay) ?? []) : []

  return (
    <div className="card cal">
      <div className="cal-controls">
        <div className="seg">
          <button className={mode === 'year' ? 'active' : ''} onClick={() => setMode('year')}>
            Рік
          </button>
          <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>
            Місяць
          </button>
        </div>
        <div className="yearnav">
          <button className="icon-btn" onClick={prev} aria-label="Назад">
            ‹
          </button>
          <strong>{mode === 'year' ? year : `${MONTHS[month]} ${year}`}</strong>
          <button className="icon-btn" onClick={next} aria-label="Вперед">
            ›
          </button>
        </div>
      </div>

      {mode === 'year' ? (
        <div className="grid-wrap">
          <div className="ygrid">
            <div className="mlabel" />
            {Array.from({ length: 31 }, (_, i) => (
              <div className="dlabel" key={i}>
                {i + 1}
              </div>
            ))}
            {Array.from({ length: 12 }, (_, m) => (
              <YearRow key={m} y={year} m={m} today={today} pixelStyle={pixelStyle} dayProps={dayProps} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mgrid">
          {WDAYS.map((w) => (
            <div className="wd" key={w}>
              {w}
            </div>
          ))}
          {Array.from({ length: (new Date(year, month, 1).getDay() + 6) % 7 }, (_, i) => (
            <div className="mcell empty" key={`e${i}`} />
          ))}
          {Array.from({ length: daysIn(year, month) }, (_, i) => {
            const day = iso(year, month, i + 1)
            const marks = byDay.get(day) ?? []
            return (
              <div className={`mcell${day === today ? ' today' : ''}`} key={day} {...dayProps(day)}>
                <span className="dn">{i + 1}</span>
                <div className="chips">
                  {marks.slice(0, MAX_MARKS).map((r) => (
                    <div className="mchip" key={r.id} style={{ background: colorOf(r) }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="legend">
        {options.map((o, i) => (
          <div className="li" key={o.id}>
            {i < 9 && <span className="num">{i + 1}</span>}
            <span className="sw" style={{ background: o.color }} />
            {o.label}
          </div>
        ))}
      </div>
      <p className="hint muted">
        Швидко: наведи курсор на день і натисни цифру статусу (повторно — зняти). До двох відміток на день.
      </p>
      {toast && <div className="toast">{toast}</div>}

      {openDay && (
        <div className="modal-bg" onClick={() => setOpenDay(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{formatDate(openDay)}</h3>
            {dayMarks.length === 0 && <p className="muted">Відміток немає.</p>}
            {dayMarks.map((r) => {
              const o = options.find((x) => x.id === r.values[cfg.statusColumnId])
              return (
                <div className="mark-row" key={r.id}>
                  <span className="chip" style={{ background: o?.color ?? '#8a8f99' }}>
                    {o?.label ?? '—'}
                  </span>
                  <Link to={`/c/${collection.id}/r/${r.id}`} className="btn ghost small">
                    Деталі
                  </Link>
                  <button className="icon-btn danger" onClick={() => deleteRecord(collection.id, r.id)} aria-label="Прибрати">
                    ✕
                  </button>
                </div>
              )
            })}
            <p className="muted small-label">Додати відмітку:</p>
            <div className="status-buttons">
              {options.map((o) => (
                <button
                  key={o.id}
                  className="chip-btn"
                  style={{ borderColor: o.color }}
                  disabled={dayMarks.length >= MAX_MARKS}
                  onClick={() => addMark(openDay, o)}
                >
                  <span className="sw" style={{ background: o.color }} /> {o.label}
                </button>
              ))}
            </div>
            <div className="form-actions">
              <Link to={`/c/${collection.id}/r/new?d=${openDay}`} className="btn ghost small">
                + З деталями
              </Link>
              <button className="btn small" onClick={() => setOpenDay(null)}>
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function YearRow({
  y,
  m,
  today,
  pixelStyle,
  dayProps,
}: {
  y: number
  m: number
  today: string
  pixelStyle: (d: string) => React.CSSProperties
  dayProps: (d: string) => Record<string, unknown>
}) {
  const dim = daysIn(y, m)
  return (
    <>
      <div className="mlabel">
        <span className="mfull">{MONTHS[m]}</span>
        <span className="mabbr">{MONTHS_AB[m]}</span>
      </div>
      {Array.from({ length: 31 }, (_, i) => {
        if (i + 1 > dim) return <div className="pix void" key={i} />
        const day = iso(y, m, i + 1)
        return (
          <div
            className={`pix${day === today ? ' today' : ''}`}
            key={i}
            style={pixelStyle(day)}
            title={formatDate(day)}
            {...dayProps(day)}
          />
        )
      })}
    </>
  )
}
