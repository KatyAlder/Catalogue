import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../data/store'
import { cellText, recordTitle } from '../data/view'
import { iconGlyph } from '../icons'

/** Пошук по всіх колекціях або лише по вибраних. */
export default function Search() {
  const { db } = useAppState()
  const collections = db.index.collections
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<Set<string>>(new Set()) // порожньо = усі

  const toggle = (id: string) =>
    setScope((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    return collections
      .filter((c) => scope.size === 0 || scope.has(c.id))
      .map((c) => ({
        c,
        records: (db.collections[c.id]?.records ?? []).filter((r) =>
          c.columns.some((col) => cellText(col, r.values[col.id]).toLowerCase().includes(query)),
        ),
      }))
      .filter((x) => x.records.length)
  }, [q, scope, collections, db.collections])

  return (
    <div className="page">
      <Link to="/" className="back">
        ← До шафи
      </Link>
      <h2>Пошук</h2>
      <input
        type="search"
        autoFocus
        placeholder="Що шукаємо?"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="wide"
      />
      <div className="scope">
        <span className="muted">Де шукати {scope.size === 0 ? '(усюди)' : ''}:</span>
        {collections.map((c) => (
          <button
            key={c.id}
            className={`chip-btn ${scope.has(c.id) ? 'active' : ''}`}
            onClick={() => toggle(c.id)}
          >
            {iconGlyph(c.icon)} {c.name}
          </button>
        ))}
      </div>

      {q.trim() && results.length === 0 && <p className="muted">Нічого не знайдено.</p>}
      {results.map(({ c, records }) => (
        <section key={c.id} className="card search-group">
          <h3>
            {iconGlyph(c.icon)} {c.name} <span className="muted">· {records.length}</span>
          </h3>
          <ul className="col-list">
            {records.map((r) => (
              <li key={r.id}>
                <Link to={`/c/${c.id}/r/${r.id}`}>{recordTitle(c.columns, r)}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
