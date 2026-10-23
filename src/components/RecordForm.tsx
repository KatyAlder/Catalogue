import { useState } from 'react'
import type { AccountKind, CellValue, Column, Investment } from '../data/types'
import { CellInput } from './Cells'

function Wrapper({ as: Tag, className, children }: { as: 'div' | 'label'; className: string; children: React.ReactNode }) {
  return <Tag className={className}>{children}</Tag>
}

interface Props {
  columns: Column[]
  initial?: Record<string, CellValue>
  onSave: (values: Record<string, CellValue>, investment: Investment | null, kind?: AccountKind) => void
  /** Показати блок «Інвестиція» (для конвертів у «Фінансах») і вибір типу рахунку */
  investmentEnabled?: boolean
  initialInvestment?: Investment
  initialKind?: AccountKind
  onCancel: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

/** Форма запису. Окремий компонент, не прив’язаний до сторінки: її можна
    буде перенести у спливаюче вікно без змін. */
export default function RecordForm({
  columns,
  initial,
  onSave,
  onCancel,
  onDuplicate,
  onDelete,
  investmentEnabled,
  initialInvestment,
  initialKind,
}: Props) {
  const [values, setValues] = useState<Record<string, CellValue>>(initial ?? {})
  const [kind, setKind] = useState<AccountKind>(initialKind ?? 'envelope')
  const [isInvest, setIsInvest] = useState(!!initialInvestment)
  const [rate, setRate] = useState(initialInvestment ? String(initialInvestment.annualRate) : '')
  const [start, setStart] = useState(initialInvestment?.startDate ?? '')
  const [term, setTerm] = useState(initialInvestment ? String(initialInvestment.termMonths) : '')
  const [compound, setCompound] = useState(!!initialInvestment?.compound)
  const [error, setError] = useState('')

  const submit = () => {
    const k = investmentEnabled ? kind : undefined
    if (!investmentEnabled || kind === 'wallet' || !isInvest) return onSave(values, null, k)
    const annualRate = Number(rate.replace(',', '.'))
    const termMonths = Number(term)
    if (!Number.isFinite(annualRate) || rate.trim() === '' || annualRate < 0)
      return setError('Вкажи річну ставку у відсотках')
    if (!start) return setError('Вкажи дату початку')
    if (!Number.isInteger(termMonths) || termMonths <= 0) return setError('Строк має бути цілою кількістю місяців')
    onSave(values, { annualRate, startDate: start, termMonths, compound }, k)
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {investmentEnabled && (
        <label className="field">
          <span>Тип рахунку</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
            <option value="envelope">Конверт (відкладені гроші)</option>
            <option value="wallet">Гаманець (гроші на витрати: картка, готівка)</option>
          </select>
        </label>
      )}
      {columns.map((c) => (
        // progress має власні кнопки: у <label> клік по підпису натискав би «−»
        <Wrapper key={c.id} as={c.type === 'progress' ? 'div' : 'label'} className={c.type === 'checkbox' ? 'check' : 'field'}>
          <span>{c.name}</span>
          <CellInput col={c} value={values[c.id]} onChange={(v) => setValues((s) => ({ ...s, [c.id]: v }))} />
        </Wrapper>
      ))}
      {investmentEnabled && kind === 'envelope' && (
        <fieldset className="invest-box">
          <label className="check">
            <input type="checkbox" checked={isInvest} onChange={(e) => setIsInvest(e.target.checked)} />
            <span>Це інвестиція або депозит (сума конверта вважається вкладеною)</span>
          </label>
          {isInvest && (
            <div className="invest-fields">
              <label className="field">
                <span>Річна ставка, %</span>
                <input type="text" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
              </label>
              <label className="field">
                <span>Дата початку</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="field">
                <span>Строк, місяців</span>
                <input type="number" min={1} step={1} value={term} onChange={(e) => setTerm(e.target.value)} />
              </label>
              <label className="field">
                <span>Відсотки</span>
                <select value={compound ? 'compound' : 'simple'} onChange={(e) => setCompound(e.target.value === 'compound')}>
                  <option value="simple">Прості</option>
                  <option value="compound">Складні (щомісячна капіталізація)</option>
                </select>
              </label>
            </div>
          )}
        </fieldset>
      )}
      {error && <p className="error">{error}</p>}
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
