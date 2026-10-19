import { Link, useNavigate, useParams } from 'react-router-dom'
import { cloneCollection, deleteCollection } from '../data/actions'
import { getCollectionData, useAppState } from '../data/store'
import { iconGlyph } from '../icons'

export default function CollectionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db } = useAppState()
  const c = db.index.collections.find((x) => x.id === id)

  if (!c) {
    return (
      <p className="notice">
        Колекцію не знайдено. <Link to="/">До шафи</Link>
      </p>
    )
  }
  const data = getCollectionData(db, c.id)

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
        <span className="title-icon">{iconGlyph(c.icon)}</span> {c.name}
      </h2>
      <div className="toolbar">
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

      <div className="card">
        <h3>Стовпці</h3>
        <ul className="col-list">
          {c.columns.map((col) => (
            <li key={col.id}>
              <strong>{col.name}</strong> <span className="muted">· {col.type}</span>
            </li>
          ))}
        </ul>
        <p className="muted">Записів: {data.records.length}. Перегляд записів з’явиться на наступному етапі.</p>
      </div>
    </div>
  )
}
