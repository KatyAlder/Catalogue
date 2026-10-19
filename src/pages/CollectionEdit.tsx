import { Link, useNavigate, useParams } from 'react-router-dom'
import CollectionForm from '../components/CollectionForm'
import { createCollection, updateCollection } from '../data/actions'
import { useAppState } from '../data/store'

/** Створення (/new) і редагування (/c/:id/edit) колекції. */
export default function CollectionEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db } = useAppState()
  const existing = id ? db.index.collections.find((c) => c.id === id) : undefined

  if (id && !existing) {
    return (
      <p className="notice">
        Колекцію не знайдено. <Link to="/">До шафи</Link>
      </p>
    )
  }

  return (
    <div className="page">
      <h2>{existing ? 'Налаштування колекції' : 'Нова колекція'}</h2>
      <CollectionForm
        mode={existing ? 'edit' : 'create'}
        initial={existing}
        onCancel={() => navigate(existing ? `/c/${existing.id}` : '/')}
        onSave={(draft) => {
          if (existing) {
            updateCollection(existing.id, draft)
            navigate(`/c/${existing.id}`)
          } else {
            navigate(`/c/${createCollection(draft)}`)
          }
        }}
      />
    </div>
  )
}
