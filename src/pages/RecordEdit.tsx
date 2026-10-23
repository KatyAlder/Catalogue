import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import RecordForm from '../components/RecordForm'
import { addRecord, deleteRecord, duplicateRecord, updateRecord } from '../data/recordActions'
import { getCollectionData, useAppState } from '../data/store'

/** Окрема сторінка запису: /c/:id/r/new і /c/:id/r/:rid */
export default function RecordEdit() {
  const { id, rid } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { db } = useAppState()
  const c = db.index.collections.find((x) => x.id === id)
  const record = rid ? getCollectionData(db, id ?? '').records.find((r) => r.id === rid) : undefined

  if (!c || (rid && !record)) {
    return (
      <p className="notice">
        Запис не знайдено. <Link to="/">До шафи</Link>
      </p>
    )
  }
  const back = `/c/${c.id}`
  // нова відмітка з календаря: дата передається в адресі (?d=YYYY-MM-DD)
  const presetDate = params.get('d')
  const initial =
    record?.values ?? (presetDate && c.tracker ? { [c.tracker.dateColumnId]: presetDate } : undefined)

  return (
    <div className="page">
      <Link to={back} className="back">
        ← {c.name}
      </Link>
      <h2>{record ? 'Редагування запису' : 'Новий запис'}</h2>
      <RecordForm
        key={record?.id ?? 'new'}
        columns={c.columns}
        initial={initial}
        investmentEnabled={c.module === 'finance'}
        initialInvestment={record?.investment}
        initialKind={record?.kind}
        onCancel={() => navigate(back)}
        onSave={(values, investment, kind) => {
          if (record) updateRecord(c.id, record.id, values, investment, kind)
          else addRecord(c.id, values, investment, kind)
          navigate(back)
        }}
        onDuplicate={
          record
            ? () => {
                const copyId = duplicateRecord(c.id, record.id)
                if (copyId) navigate(`${back}/r/${copyId}`)
              }
            : undefined
        }
        onDelete={
          record
            ? () => {
                if (window.confirm('Видалити цей запис? Це не можна скасувати.')) {
                  deleteRecord(c.id, record.id)
                  navigate(back)
                }
              }
            : undefined
        }
      />
    </div>
  )
}
