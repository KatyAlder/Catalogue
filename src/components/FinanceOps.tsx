import { useMemo, useState } from 'react'
import { addOperation, deleteOperation, updateOperation } from '../data/financeActions'
import type { NewOperation } from '../data/financeActions'
import { avgExchangeRate, envelopesOf, exchangeRateText, fmtMoney, todayISO, walletsFirst } from '../data/finance'
import type { CollectionData, CollectionMeta, Operation } from '../data/types'
import { formatDate } from '../data/view'

const parseNum = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

interface FormProps {
  collection: CollectionMeta
  data: CollectionData
  type: 'income' | 'transfer'
  /** Рахунок, з якого відкрито форму (надходження — сюди, переказ — звідси) */
  accountId?: string
  editing?: Operation
  onDone: () => void
}

/** Надходження із джерелом або переказ між рахунками (з фактичним курсом при обміні). */
export function OperationForm({ collection, data, type, accountId, editing, onDone }: FormProps) {
  const f = collection.finance!
  const accounts = useMemo(() => walletsFirst(envelopesOf(collection, data.records)), [collection, data.records])
  const byId = (id: string) => accounts.find((a) => a.record.id === id)

  const [from, setFrom] = useState(editing?.fromId ?? accountId ?? accounts[0]?.record.id ?? '')
  const [to, setTo] = useState(
    editing?.toId ?? (type === 'income' ? '' : accounts.find((a) => a.record.id !== (accountId ?? accounts[0]?.record.id))?.record.id ?? ''),
  )
  const [acc, setAcc] = useState(editing?.accountId ?? accountId ?? accounts[0]?.record.id ?? '')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [toAmount, setToAmount] = useState(editing?.toAmount !== undefined ? String(editing.toAmount) : '')
  const [date, setDate] = useState(editing?.date ?? todayISO())
  const [source, setSource] = useState(editing?.source ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [error, setError] = useState('')

  const sources = useMemo(() => {
    const seen = new Map<string, string>()
    for (const o of data.operations ?? []) {
      const s = o.source?.trim()
      if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s)
    }
    for (const a of data.audits ?? []) {
      for (const l of a.incomes) {
        const s = l.name.trim()
        if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s)
      }
    }
    return [...seen.values()]
  }, [data.operations, data.audits])

  const fromAcc = byId(from)
  const toAcc = byId(to)
  const accAcc = byId(acc)
  const fromCur = fromAcc?.currency || f.baseCurrency
  const toCur = toAcc?.currency || f.baseCurrency
  const exchange = type === 'transfer' && fromCur !== toCur

  const amountN = parseNum(amount)
  const toAmountN = parseNum(toAmount)
  const rateHint = exchange && amountN > 0 && toAmountN > 0
    ? exchangeRateText({ currency: fromCur, toCurrency: toCur, amount: amountN, toAmount: toAmountN }, f.baseCurrency)
    : ''

  const submit = () => {
    if (!Number.isFinite(amountN) || amountN <= 0) return setError('Вкажи суму більше нуля')
    if (!date) return setError('Вкажи дату')
    let op: NewOperation
    if (type === 'income') {
      if (!accAcc) return setError('Обери рахунок')
      op = {
        date,
        type,
        accountId: acc,
        amount: amountN,
        currency: accAcc.currency || f.baseCurrency,
        source: source.trim() || undefined,
        note: note.trim() || undefined,
      }
    } else {
      if (!fromAcc || !toAcc) return setError('Обери обидва рахунки')
      if (from === to) return setError('Рахунки мають бути різні')
      if (exchange && (!Number.isFinite(toAmountN) || toAmountN <= 0)) return setError('Вкажи, скільки отримала')
      op = {
        date,
        type,
        fromId: from,
        toId: to,
        amount: amountN,
        currency: fromCur,
        toAmount: exchange ? toAmountN : amountN,
        toCurrency: toCur,
        note: note.trim() || undefined,
      }
    }
    if (editing) updateOperation(collection.id, editing.id, op)
    else addOperation(collection.id, op)
    onDone()
  }

  const opts = accounts.map((a) => (
    <option key={a.record.id} value={a.record.id}>
      {a.name} ({a.currency || f.baseCurrency})
    </option>
  ))

  return (
    <div className="card op-form">
      <h3>
        {editing ? 'Змінити: ' : ''}
        {type === 'income' ? 'Надходження' : 'Переказ між рахунками'}
      </h3>
      <div className="op-grid">
        {type === 'income' ? (
          <>
            <label className="field">
              <span>На рахунок</span>
              <select value={acc} onChange={(e) => setAcc(e.target.value)}>
                {opts}
              </select>
            </label>
            <label className="field">
              <span>Сума{accAcc ? `, ${accAcc.currency || f.baseCurrency}` : ''}</span>
              <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="field">
              <span>Джерело</span>
              <input
                type="text"
                list="fin-sources"
                placeholder="Зарплата, фріланс, подарунок…"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
              <datalist id="fin-sources">
                {sources.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>З рахунку</span>
              <select value={from} onChange={(e) => setFrom(e.target.value)}>
                {opts}
              </select>
            </label>
            <label className="field">
              <span>На рахунок</span>
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">— обери —</option>
                {opts}
              </select>
            </label>
            <label className="field">
              <span>{exchange ? `Віддала, ${fromCur}` : `Сума, ${fromCur}`}</span>
              <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            {exchange && (
              <label className="field">
                <span>Отримала, {toCur}</span>
                <input type="text" inputMode="decimal" value={toAmount} onChange={(e) => setToAmount(e.target.value)} />
              </label>
            )}
          </>
        )}
        <label className="field">
          <span>Дата</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Нотатка</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      {rateHint && <p className="muted small-label">Курс обміну: {rateHint}</p>}
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button className="btn" onClick={submit}>
          Зберегти
        </button>
        <button className="btn ghost" onClick={onDone}>
          Скасувати
        </button>
      </div>
      <p className="muted small-label">Залишки на рахунках оновляться автоматично.</p>
    </div>
  )
}

/* ---------------- вкладка «Операції» ---------------- */

export function OpsTab({ collection, data }: { collection: CollectionMeta; data: CollectionData }) {
  const f = collection.finance!
  const ops = data.operations ?? []
  const accounts = useMemo(() => walletsFirst(envelopesOf(collection, data.records)), [collection, data.records])
  const nameOf = (id?: string) => accounts.find((a) => a.record.id === id)?.name ?? '(видалений рахунок)'

  const [filter, setFilter] = useState('')
  const [showAdjust, setShowAdjust] = useState(true)
  const [form, setForm] = useState<{ type: 'income' | 'transfer'; editing?: Operation } | null>(null)

  const shown = ops
    .filter((o) => showAdjust || o.type !== 'adjust')
    .filter((o) => !filter || o.accountId === filter || o.fromId === filter || o.toId === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt)

  const avgRows = [...new Set(accounts.map((a) => a.currency).filter((c) => c && c !== f.baseCurrency))]
    .map((cur) => ({ cur, avg: avgExchangeRate(ops, filter || null, cur, f.baseCurrency) }))
    .filter((r) => r.avg)

  const remove = (o: Operation) => {
    const msg =
      o.type === 'adjust'
        ? 'Видалити запис з історії? Баланс рахунку не зміниться.'
        : 'Видалити операцію? Залишки на рахунках повернуться до стану до неї.'
    if (window.confirm(msg)) deleteOperation(collection.id, o.id)
  }

  const describe = (o: Operation) => {
    if (o.type === 'income') return { label: 'Надходження', text: `${o.source || 'без джерела'} → ${nameOf(o.accountId)}`, amount: `+${fmtMoney(o.amount)} ${o.currency}` }
    if (o.type === 'adjust')
      return { label: 'Зміна', text: nameOf(o.accountId), amount: `${o.amount > 0 ? '+' : ''}${fmtMoney(o.amount)} ${o.currency}` }
    const rate = exchangeRateText(o, f.baseCurrency)
    const same = !o.toCurrency || o.toCurrency === o.currency
    return {
      label: 'Переказ',
      text: `${nameOf(o.fromId)} → ${nameOf(o.toId)}${rate ? ` · ${rate}` : ''}`,
      amount: same ? `${fmtMoney(o.amount)} ${o.currency}` : `${fmtMoney(o.amount)} ${o.currency} → ${fmtMoney(o.toAmount ?? 0)} ${o.toCurrency}`,
    }
  }

  return (
    <div>
      {form ? (
        <OperationForm
          key={form.editing?.id ?? form.type}
          collection={collection}
          data={data}
          type={form.type}
          accountId={filter || undefined}
          editing={form.editing}
          onDone={() => setForm(null)}
        />
      ) : (
        <div className="toolbar">
          <button className="btn" onClick={() => setForm({ type: 'income' })} disabled={!accounts.length}>
            + Надходження
          </button>
          <button className="btn" onClick={() => setForm({ type: 'transfer' })} disabled={accounts.length < 2}>
            + Переказ
          </button>
        </div>
      )}

      <div className="card">
        <h3>Журнал</h3>
        <div className="cal-controls">
          <label className="inline">
            Рахунок
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">усі</option>
              {accounts.map((a) => (
                <option key={a.record.id} value={a.record.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={showAdjust} onChange={(e) => setShowAdjust(e.target.checked)} />
            <span>Показувати зміни</span>
          </label>
        </div>
        {avgRows.length > 0 && (
          <div className="fin-by-cur">
            {avgRows.map((r) => (
              <span key={r.cur} className="chip-static">
                Середній курс {r.cur}: 1 {r.cur} ≈ {fmtMoney(r.avg!.rate)} {f.baseCurrency}
                <span className="muted"> · {r.avg!.count} обм.</span>
              </span>
            ))}
          </div>
        )}
        {shown.length === 0 ? (
          <p className="muted">
            Операцій ще немає. Журнал веде лише значущі події: надходження, перекази й зміни сум. Щоденні витрати
            записувати не потрібно.
          </p>
        ) : (
          <div className="op-list">
            {shown.map((o) => {
              const d = describe(o)
              return (
                <div key={o.id} className={`op-row${o.type === 'adjust' ? ' adjust' : ''}`}>
                  <span className="op-date">{formatDate(o.date)}</span>
                  <span className="op-main">
                    <strong>{d.label}</strong> · {d.text}
                    {o.note && <span className="muted"> · {o.note}</span>}
                  </span>
                  <span className="op-amount">{d.amount}</span>
                  <span className="op-actions">
                    {o.type !== 'adjust' && (
                      <button className="btn ghost small" onClick={() => setForm({ type: o.type as 'income' | 'transfer', editing: o })}>
                        Змінити
                      </button>
                    )}
                    <button className="btn ghost small danger" onClick={() => remove(o)}>
                      ✕
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
