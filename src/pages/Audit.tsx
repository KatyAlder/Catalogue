import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AUDIT_FREQ, fmtMoney, quarterAmount, quarterLabel, todayISO, totalsOf } from '../data/finance'
import { deleteAudit, saveAudit } from '../data/financeActions'
import { getCollectionData, useAppState } from '../data/store'
import type { Audit as AuditT, AuditFreq, AuditLine, CollectionMeta } from '../data/types'
import { uid } from '../data/types'
import { formatDate } from '../data/view'

/** Квартальний аудит: очікувані надходження й фіксовані витрати. Планування, не облік. */
export default function Audit() {
  const { id } = useParams()
  const { db } = useAppState()
  const c = db.index.collections.find((x) => x.id === id)
  const data = c ? getCollectionData(db, c.id) : null
  const [pickedId, setPickedId] = useState<string | null>(null)

  if (!c || !data || !c.finance) {
    return (
      <p className="notice">
        Колекцію не знайдено. <Link to="/">До шафи</Link>
      </p>
    )
  }
  const f = c.finance
  const audits = [...(data.audits ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const current = audits.find((a) => a.id === pickedId) ?? audits[0]

  const blank = (): AuditLine => ({ id: uid(), name: '', amount: 0, currency: f.baseCurrency, freq: 'month' })

  /** Новий аудит починається з копії попереднього: більшість рядків між кварталами не змінюється. */
  const create = () => {
    const prev = audits[0]
    const copy = (ls: AuditLine[]) => ls.map((l) => ({ ...l, id: uid() }))
    const a: AuditT = {
      id: uid(),
      date: todayISO(),
      incomes: prev ? copy(prev.incomes) : [blank()],
      expenses: prev ? copy(prev.expenses) : [blank()],
      note: '',
      updatedAt: Date.now(),
    }
    saveAudit(c.id, a)
    setPickedId(a.id)
  }

  const remove = (a: AuditT) => {
    if (window.confirm(`Видалити аудит «${quarterLabel(a.date)}» від ${formatDate(a.date)}? Це не можна скасувати.`)) {
      deleteAudit(c.id, a.id)
      setPickedId(null)
    }
  }

  return (
    <div className="page">
      <Link to={`/c/${c.id}`} className="back">
        ← {c.name}
      </Link>
      <h2>Квартальний аудит</h2>
      <p className="muted">
        План на квартал: що має надійти і що витрачається щоразу. Це не облік витрат, а лише фіксований кістяк.
      </p>
      <div className="toolbar">
        <button className="btn" onClick={create}>
          + Новий аудит{audits.length ? ' (копія попереднього)' : ''}
        </button>
        {audits.length > 0 && (
          <select
            aria-label="Обери аудит"
            value={current?.id}
            onChange={(e) => setPickedId(e.target.value)}
          >
            {audits.map((a) => (
              <option key={a.id} value={a.id}>
                {quarterLabel(a.date)} · {formatDate(a.date)}
              </option>
            ))}
          </select>
        )}
        {current && (
          <button className="btn ghost danger" onClick={() => remove(current)}>
            Видалити аудит
          </button>
        )}
      </div>
      {current ? (
        <AuditEditor key={current.id} collection={c} audit={current} />
      ) : (
        <p className="muted">Аудитів ще немає. Натисни «+ Новий аудит».</p>
      )}
    </div>
  )
}

/** Текст зберігається окремо, щоб можна було набрати «1,» чи «1.5» до завершення числа. */
function AmountInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(value === 0 ? '' : String(value))
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label="Сума"
      placeholder="0"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value.replace(/\s/g, '').replace(',', '.'))
        onChange(e.target.value.trim() === '' ? 0 : Number.isFinite(n) ? n : value)
      }}
    />
  )
}

function AuditEditor({ collection, audit }: { collection: CollectionMeta; audit: AuditT }) {
  const f = collection.finance!
  const curCol = collection.columns.find((x) => x.id === f.currencyColumnId)
  const codes = (curCol?.options ?? []).map((o) => o.label).filter(Boolean)
  const [draft, setDraft] = useState<AuditT>(audit)

  // автозбереження з невеликою затримкою; незбережене дописується при виході зі сторінки
  const latest = useRef(draft)
  const saved = useRef(JSON.stringify(audit))
  latest.current = draft
  const flush = () => {
    const s = JSON.stringify(latest.current)
    if (s !== saved.current) {
      saved.current = s
      saveAudit(collection.id, latest.current)
    }
  }
  useEffect(() => {
    const t = setTimeout(flush, 600)
    return () => clearTimeout(t)
  })
  useEffect(() => flush, [])

  const setLines = (key: 'incomes' | 'expenses', fn: (ls: AuditLine[]) => AuditLine[]) =>
    setDraft((d) => ({ ...d, [key]: fn(d[key]) }))

  const sums = useMemo(() => {
    const calc = (ls: AuditLine[]) =>
      totalsOf(
        ls.map((l) => ({ currency: l.currency, amount: quarterAmount(l) })),
        f.baseCurrency,
        f.rates,
      )
    const inc = calc(draft.incomes)
    const exp = calc(draft.expenses)
    return { inc, exp, missing: [...new Set([...inc.missing, ...exp.missing])] }
  }, [draft.incomes, draft.expenses, f])

  const row = (key: 'incomes' | 'expenses', l: AuditLine) => {
    const patch = (p: Partial<AuditLine>) => setLines(key, (ls) => ls.map((x) => (x.id === l.id ? { ...x, ...p } : x)))
    return (
      <div className="audit-row" key={l.id}>
        <input
          type="text"
          aria-label="Назва"
          placeholder={key === 'incomes' ? 'Джерело' : 'Назва витрати'}
          value={l.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
        <AmountInput value={l.amount} onChange={(n) => patch({ amount: n })} />
        <select aria-label="Валюта" value={l.currency} onChange={(e) => patch({ currency: e.target.value })}>
          {codes.map((cc) => (
            <option key={cc}>{cc}</option>
          ))}
        </select>
        <select aria-label="Періодичність" value={l.freq} onChange={(e) => patch({ freq: e.target.value as AuditFreq })}>
          {AUDIT_FREQ.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label="Коли"
          placeholder="коли (необов’язково)"
          value={l.when ?? ''}
          onChange={(e) => patch({ when: e.target.value })}
        />
        <button className="icon-btn" aria-label="Прибрати рядок" onClick={() => setLines(key, (ls) => ls.filter((x) => x.id !== l.id))}>
          ✕
        </button>
      </div>
    )
  }

  const section = (key: 'incomes' | 'expenses', title: string) => (
    <div className="card">
      <h3>{title}</h3>
      <div className="audit-list">{draft[key].map((l) => row(key, l))}</div>
      <button
        className="btn ghost small"
        onClick={() =>
          setLines(key, (ls) => [...ls, { id: uid(), name: '', amount: 0, currency: f.baseCurrency, freq: 'month' }])
        }
      >
        + Рядок
      </button>
    </div>
  )

  const incQ = sums.inc.approx
  const expQ = sums.exp.approx
  const diffQ = incQ - expQ

  return (
    <div>
      <label className="field narrow">
        <span>Дата аудиту</span>
        <input type="date" value={draft.date} onChange={(e) => e.target.value && setDraft((d) => ({ ...d, date: e.target.value }))} />
      </label>
      <p className="muted small-label">{quarterLabel(draft.date)}</p>

      {section('incomes', 'Очікувані надходження')}
      {section('expenses', 'Фіксовані витрати')}

      <div className="card">
        <h3>Підсумок у {f.baseCurrency}</h3>
        <table className="records audit-sums">
          <thead>
            <tr>
              <th></th>
              <th>На місяць</th>
              <th>На квартал</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Надходження</td>
              <td>≈ {fmtMoney(incQ / 3)}</td>
              <td>≈ {fmtMoney(incQ)}</td>
            </tr>
            <tr>
              <td>Фіксовані витрати</td>
              <td>≈ {fmtMoney(expQ / 3)}</td>
              <td>≈ {fmtMoney(expQ)}</td>
            </tr>
            <tr>
              <td>
                <strong>Різниця</strong>
              </td>
              <td>
                <strong>≈ {fmtMoney(diffQ / 3)}</strong>
              </td>
              <td>
                <strong>≈ {fmtMoney(diffQ)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="muted small-label">
          Щомісячні рядки множаться на 3, «раз на квартал» і «разово» враховуються один раз. Суми приблизні, за курсами з вкладки «Курси».
        </p>
        {sums.missing.length > 0 && (
          <p className="error small-label">Не задано курс для: {sums.missing.join(', ')}. Ці рядки не входять у підсумок.</p>
        )}
      </div>

      <div className="card">
        <h3>Нотатка</h3>
        <textarea
          rows={5}
          value={draft.note}
          placeholder="Вільні міркування до цього аудиту"
          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
        />
      </div>
    </div>
  )
}
