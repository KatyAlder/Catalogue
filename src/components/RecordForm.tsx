import { useState } from 'react'
import type { CellValue, Column } from '../data/types'
import { CellInput } from './Cells'

function Wrapper({ as: Tag, className, children }: { as: 'div' | 'label'; className: string; children: React.ReactNode }) {
  return <Tag className={className}>{children}</Tag>
}

interface Props {
  columns: Column[]
  initial?: Record<string, CellValue>
  onSave: (values: Record<string, CellValue>) => void
  onCancel: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

/** Форма запису. Окремий компонент, не прив’язаний до сторінки: її можна
    буде перенести у спливаюче вікно без змін. */
export default function RecordForm({ columns, initial, onSave, onCancel, onDuplicate, onDelete }: Props) {
  const [values, setValues] = useState<Record<string, CellValue>>(initial ?? {})

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(values)
      }}
    >
      {columns.map((c) => (
        // progress має власні кнопки: у <label> клік по підпису натискав би «−»
        <Wrapper key={c.id} as={c.type === 'progress' ? 'div' : 'label'} className={c.type === 'checkbox' ? 'check' : 'field'}>
          <span>{c.name}</span>
          <CellInput col={c} value={values[c.id]} onChange={(v) => setValues((s) => ({ ...s, [c.id]: v }))} />
        </Wrapper>
      ))}
      <div className="form-actions">
        <button type="submit" className="btn">
          Зберегти
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Скасувати
        </button>
        {onDuplicate && (
          <button type="button" className="btn ghost" onClick={onDuplicate}>
            Дублювати
          </button>
        )}
        {onDelete && (
          <button type="button" className="btn ghost danger" onClick={onDelete}>
            Видалити
          </button>
        )}
      </div>
    </form>
  )
}
