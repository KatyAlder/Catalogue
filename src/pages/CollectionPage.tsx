import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RecordsTable, RecordsTiles } from '../components/RecordViews'
import Finance from '../components/Finance'
import type { FinanceTab } from '../components/Finance'
import TrackerCalendar from '../components/TrackerCalendar'
import { cloneCollection, deleteCollection } from '../data/actions'
import { getCollectionData, useAppState } from '../data/store'
import type { RecordItem } from '../data/types'
import { buildGroups, emptyView, isFilterable, recordTitle } from '../data/view'
import { Icon } from '../icons'

type Mode = 'table' | 'tiles' | 'calendar' | FinanceTab

export default function CollectionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db } = useAppState()
  const c = db.index.collections.find((x) => x.id === id)

  const [mode, setMode] = useState<Mode>('table')
  const [modeTouched, setModeTouched] = useState(false)
  const [view, setView] = useState(emptyView())
  const [picked, setPicked] = useState<RecordItem | null>(null)

  const data = c ? getCollectionData(db, c.id) : null
  const groups = useMemo(
    () => (c && data ? buildGroups(c.columns, data.records, view) : []),
    [c, data, view],
  )

  if (!c || !data) {
    return (
      <p className="notice">
        Колекцію не знайдено. <Link to="/">До шафи</Link>
      </p>
    )
  }

  const isTracker = c.module === 'tracker' && !!c.tracker
  const isFinance = c.module === 'finance' && !!c.finance
  const effMode: Mode = modeTouched ? mode : isTracker ? 'calendar' : isFinance ? 'update' : mode
  const isRecordsView = effMode === 'table' || effMode === 'tiles'
  const chooseMode = (m: Mode) => {
    setMode(m)
    setModeTouched(true)
  }
  if (c.module === 'link') {
    return (
      <div className="page">
        <Link to="/" className="back">
          ← До шафи
        </Link>
        <h2>{c.name}</h2>
        <p className="muted">Це ярлик, а не колекція. Посилання: {c.url}</p>
        <div className="toolbar">
          <a className="btn" href={c.url} target="_blank" rel="noopener noreferrer">
            Відкрити
          </a>
          <Link to={`/c/${c.id}/edit`} className="btn ghost">
            Налаштування
          </Link>
        </div>
      </div>
    )
  }
  const shown = groups.flatMap((g) => g.records)
  const filterCols = c.columns.filter(isFilterable)
  const sortable = c.columns.filter((x) => x.type !== 'photo')

  const patch = (p: Partial<typeof view>) => setView((v) => ({ ...v, ...p }))
  const onSort = (colId: string) =>
    setView((v) =>
      v.sortCol === colId
        ? { ...v, sortDir: v.sortDir === 'asc' ? 'desc' : 'asc' }
        : { ...v, sortCol: colId, sortDir: 'asc' },
    )

  const random = () => {
    if (!shown.length) return
    setPicked(shown[Math.floor(Math.random() * shown.length)])
  }

  const onClone = () => {
    const withData =
      data.records.length > 0 &&
      window.confirm('Скопіювати разом із записами?\n\nОК — з даними, Скасувати — лише структуру.')
    const newId = cloneCollection(c.id, withData)
    if (newId) navigate(`/c/${newId}/edit`)
  }

  const onDelete = () => {
    if (window.confirm(`Видалити колекцію «${c.name}» разом з усіма записами? Це не можна скасувати.`)) {
      deleteCollection(c.id)
      navigate('/')
    }
  }

  return (
    <div className="page">
      <Link to="/" className="back">
        ← До шафи
      </Link>
      <h2>
        <Icon name={c.icon} size={28} className="title-icon" /> {c.name}
      </h2>

      <div className="toolbar">
        <Link to={`/c/${c.id}/r/new`} className="btn">
          + Запис
        </Link>
        <button className="btn ghost" onClick={random} disabled={!shown.length}>
          🎲 Випадковий
        </button>
        <div className="seg">
          {isTracker && (
            <button className={effMode === 'calendar' ? 'active' : ''} onClick={() => chooseMode('calendar')}>
              Календар
            </button>
          )}
          {isFinance &&
            (
              [
                ['update', 'Оновлення'],
                ['ops', 'Операції'],
                ['dynamics', 'Динаміка'],
                ['invest', 'Інвестиції'],
                ['rates', 'Курси'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className={effMode === k ? 'active' : ''} onClick={() => chooseMode(k)}>
                {label}
              </button>
            ))}
          <button className={effMode === 'table' ? 'active' : ''} onClick={() => chooseMode('table')}>
            Таблиця
          </button>
          <button className={effMode === 'tiles' ? 'active' : ''} onClick={() => chooseMode('tiles')}>
            Плитка
          </button>
        </div>
        {isFinance && (
          <Link to={`/c/${c.id}/audit`} className="btn ghost">
            Квартальний аудит
          </Link>
        )}
        <Link to={`/c/${c.id}/edit`} className="btn ghost">
          Налаштування
        </Link>
        <button className="btn ghost" onClick={onClone}>
          Копіювати
        </button>
        <button className="btn ghost danger" onClick={onDelete}>
          Видалити
        </button>
      </div>

      {effMode === 'calendar' && <TrackerCalendar collection={c} records={data.records} />}
      {isFinance && !isRecordsView && <Finance collection={c} data={data} tab={effMode as FinanceTab} />}

      {isRecordsView && (
      <div className="controls">
        <input
          type="search"
          placeholder="Пошук у колекції…"
          value={view.search}
          onChange={(e) => patch({ search: e.target.value })}
        />
        <label className="inline">
          Сортувати
          <select value={view.sortCol} onChange={(e) => patch({ sortCol: e.target.value })}>
            <option value="">—</option>
            {sortable.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          {view.sortCol && (
            <button
              className="icon-btn"
              onClick={() => patch({ sortDir: view.sortDir === 'asc' ? 'desc' : 'asc' })}
              aria-label="Змінити напрямок"
            >
              {view.sortDir === 'asc' ? '▲' : '▼'}
            </button>
          )}
        </label>
        <label className="inline">
          Групувати
          <select value={view.groupCol} onChange={(e) => patch({ groupCol: e.target.value })}>
            <option value="">—</option>
            {sortable.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        {filterCols.map((x) => (
          <label className="inline" key={x.id}>
            {x.name}
            <select
              value={view.filters[x.id] ?? ''}
              onChange={(e) => patch({ filters: { ...view.filters, [x.id]: e.target.value } })}
            >
              <option value="">усі</option>
              {x.type === 'checkbox' ? (
                <>
                  <option value="yes">Так</option>
                  <option value="no">Ні</option>
                </>
              ) : (
                (x.options ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))
              )}
            </select>
          </label>
        ))}
        {(view.search || view.sortCol || view.groupCol || Object.values(view.filters).some(Boolean)) && (
          <button className="btn ghost small" onClick={() => setView(emptyView())}>
            Скинути
          </button>
        )}
      </div>
      )}

      {picked && (
        <div className="picked">
          <span>
            Випало: <strong>{recordTitle(c.columns, picked)}</strong>
          </span>
          <Link to={`/c/${c.id}/r/${picked.id}`} className="btn small">
            Відкрити
          </Link>
          <button className="btn ghost small" onClick={random}>
            Ще раз
          </button>
          <button className="icon-btn" onClick={() => setPicked(null)} aria-label="Закрити">
            ✕
          </button>
        </div>
      )}

      {!isRecordsView ? null : data.records.length === 0 ? (
        <p className="muted">Записів ще немає. Натисни «+ Запис».</p>
      ) : shown.length === 0 ? (
        <p className="muted">Нічого не знайдено за цими умовами.</p>
      ) : effMode === 'table' ? (
        <RecordsTable collectionId={c.id} columns={c.columns} groups={groups} view={view} onSort={onSort} />
      ) : (
        <RecordsTiles collectionId={c.id} columns={c.columns} groups={groups} view={view} onSort={onSort} />
      )}
    </div>
  )
}
