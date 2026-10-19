import { Link } from 'react-router-dom'
import { useAppState } from '../data/store'
import { iconGlyph } from '../icons'

export default function Wardrobe() {
  const { db } = useAppState()
  const { shelves, collections, settings } = db.index
  const byId = new Map(collections.map((c) => [c.id, c]))

  return (
    <>
      <div className="toolbar">
        <Link to="/new" className="btn">
          + Нова колекція
        </Link>
      </div>
      <main className="wardrobe">
        {shelves.map((shelf) => (
          <section key={shelf.id} className="shelf">
            {settings.showShelfNames && <h2>{shelf.name}</h2>}
            <div className="shelf-row">
              {shelf.collectionIds.length === 0 && <span className="empty">Полиця порожня</span>}
              {shelf.collectionIds.map((id) => {
                const c = byId.get(id)
                if (!c) return null
                return (
                  <Link key={id} to={`/c/${id}`} className="box" title={c.name}>
                    <span className="box-icon">{iconGlyph(c.icon)}</span>
                    <span className="box-name">{c.name}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </>
  )
}
