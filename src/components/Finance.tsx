import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { saveFinanceUpdate, updateFinanceConfig } from '../data/financeActions'
import { calcInvestment, isValidInvestment } from '../data/investment'
import { agoText, envelopesOf, fmtMoney, lastSnapshotDate, rateOf, todayISO, totalsOf } from '../data/finance'
import type { CollectionData, CollectionMeta } from '../data/types'
import { formatDate } from '../data/view'

export type FinanceTab = 'update' | 'dynamics' | 'invest' | 'rates'

interface Props {
  collection: CollectionMeta
  data: CollectionData
  tab: FinanceTab
}

const LINE_COLORS = ['#d9a05b', '#6fae6a', '#5a8fd9', '#d9695a', '#b377d1', '#4fb3b3', '#e0b84a', '#8a8f99']

export default function Finance({ collection, data, tab }: Props) {
  const f = collection.finance
  if (!f) return <p className="notice">Для цієї колекції не налаштовано модуль «Фінанси».</p>

  const items = envelopesOf(collection, data.records)
  const totals = totalsOf(items, f.baseCurrency, f.rates)
  const last = lastSnapshotDate(data.snapshots)

  return (
    <div>
      <div className="card fin-summary">
        <div className="fin-total">
          <span className="muted">Разом, приблизно</span>
          <strong>
            ≈ {fmtMoney(totals.approx)} {f.baseCurrency}
          </strong>
        </div>
        <div className="fin-by-cur">
          {Object.entries(totals.byCurrency).map(([cur, sum]) => (
            <span key={cur} className="chip-static">
              {fmtMoney(sum)} {cur}
            </span>
          ))}
        </div>
        {totals.missing.length > 0 && (
          <p className="error small-label">
            Не задано курс для: {totals.missing.join(', ')}. Ці суми не входять у загальну. Задай їх у «Курсах».
          </p>
        )}
        <p className="muted small-label">{last ? `${agoText(last)} (${formatDate(last)})` : 'Знімків ще немає'}</p>
      </div>

      {tab === 'update' && <QuickUpdate collection={collection} data={data} />}
      {tab === 'dynamics' && <Dynamics collection={collection} data={data} />}
      {tab === 'invest' && <Investments collection={collection} data={data} />}
      {tab === 'rates' && <Rates collection={collection} />}
    </div>
  )
}

/* ---------------- швидке оновлення ---------------- */

function QuickUpdate({ collection, data }: { collection: CollectionMeta; data: CollectionData }) {
  const f = collection.finance!
  const items = envelopesOf(collection, data.records)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [date, setDate] = useState(todayISO())
  const [saved, setSaved] = useState('')

  const valueOf = (id: string, amount: number) => drafts[id] ?? String(amount)

  const save = () => {
    const entries = items.map((it) => {
      const raw = (drafts[it.record.id] ?? '').replace(',', '.').trim()
      const n = raw === '' ? it.amount : Number(raw)
      return { id: it.record.id, amount: Number.isFinite(n) ? n : it.amount, currency: it.currency }
    })
    saveFinanceUpdate(collection.id, f.amountColumnId, date, entries)
    setDrafts({})
    setSaved(`Знімок на ${formatDate(date)} збережено`)
    setTimeout(() => setSaved(''), 3000)
  }

  if (!items.length) {
    return (
      <p className="muted">
        Конвертів ще немає. <Link to={`/c/${collection.id}/r/new`}>Додай перший конверт</Link>.
      </p>
    )
  }

  return (
    <div className="card">
      <h3>Швидке оновлення</h3>
      <p className="muted small-label">
        Онови суми й натисни «Зберегти оновлення»: це зафіксує знімок усіх конвертів на обрану дату.
      </p>
      <div className="upd-list">
        {items.map((it) => (
          <label className="upd-row" key={it.record.id}>
            <span className="upd-name">{it.name}</span>
            <input
              type="text"
              inputMode="decimal"
              value={valueOf(it.record.id, it.amount)}
              onChange={(e) => setDrafts((d) => ({ ...d, [it.record.id]: e.target.value }))}
            />
            <span className="upd-cur">{it.currency || f.baseCurrency}</span>
          </label>
        ))}
      </div>
      <div className="form-actions upd-actions">
        <label className="inline">
          Дата знімка
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="btn" onClick={save} disabled={!date}>
          Зберегти оновлення
        </button>
        <Link to={`/c/${collection.id}/r/new`} className="btn ghost">
          + Конверт
        </Link>
      </div>
      {saved && <p className="ok">{saved}</p>}
    </div>
  )
}

/* ---------------- динаміка ---------------- */

type Period = '1m' | '3m' | '6m' | '12m' | 'all'
const PERIODS: [Period, string, number][] = [
  ['1m', 'Місяць', 31],
  ['3m', '3 місяці', 92],
  ['6m', 'Пів року', 183],
  ['12m', 'Рік', 366],
  ['all', 'Весь час', 0],
]

function Dynamics({ collection, data }: { collection: CollectionMeta; data: CollectionData }) {
  const f = collection.finance!
  const [period, setPeriod] = useState<Period>('3m')
  const [byEnvelope, setByEnvelope] = useState(false)
  const [now] = useState(() => Date.now())

  const envNames = useMemo(() => {
    const map = new Map(envelopesOf(collection, data.records).map((e) => [e.record.id, e.name]))
    return map
  }, [collection, data.records])

  const rows = useMemo(() => {
    // за одну дату лишаємо останній знімок (на випадок збігу з різних пристроїв)
    const byDate = new Map<string, (typeof data.snapshots)[number]>()
    for (const s of data.snapshots) {
      const ex = byDate.get(s.date)
      if (!ex || s.updatedAt > ex.updatedAt) byDate.set(s.date, s)
    }
    const days = PERIODS.find((p) => p[0] === period)?.[2] ?? 0
    const cutoff = days ? new Date(now - days * 86400000).toISOString().slice(0, 10) : ''
    return [...byDate.values()]
      .filter((s) => s.date >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        const row: Record<string, number | string> = { date: formatDate(s.date).slice(0, 5) + '.' + s.date.slice(2, 4) }
        let total = 0
        for (const [id, amount] of Object.entries(s.amounts)) {
          const cur = s.currencies?.[id] ?? f.baseCurrency
          const r = rateOf(cur, f.baseCurrency, f.rates)
          if (r === undefined) continue
          const inBase = amount * r
          total += inBase
          row[id] = Math.round(inBase * 100) / 100
        }
        row.total = Math.round(total * 100) / 100
        return row
      })
  }, [data.snapshots, period, f, now])

  const envIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of data.snapshots) Object.keys(s.amounts).forEach((id) => ids.add(id))
    return [...ids]
  }, [data.snapshots])

  if (data.snapshots.length === 0) {
    return <p className="muted">Знімків ще немає. Збережи перше оновлення у вкладці «Швидке оновлення».</p>
  }

  return (
    <div className="card">
      <h3>Динаміка</h3>
      <div className="cal-controls">
        <div className="seg">
          {PERIODS.map(([k, label]) => (
            <button key={k} className={period === k ? 'active' : ''} onClick={() => setPeriod(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="seg">
          <button className={!byEnvelope ? 'active' : ''} onClick={() => setByEnvelope(false)}>
            Разом
          </button>
          <button className={byEnvelope ? 'active' : ''} onClick={() => setByEnvelope(true)}>
            По конвертах
          </button>
        </div>
      </div>
      <p className="muted small-label">
        Усі суми перераховані в {f.baseCurrency} за приблизними курсами. Точки це знімки, збережені явною дією.
      </p>
      {rows.length === 0 ? (
        <p className="muted">За цей період знімків немає.</p>
      ) : (
        <div className="chart">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#3b261a" />
              <XAxis dataKey="date" stroke="#b39b80" fontSize={12} />
              <YAxis stroke="#b39b80" fontSize={12} width={64} tickFormatter={(v: number) => fmtMoney(v)} />
              <Tooltip
                contentStyle={{ background: '#2a1b11', border: '1px solid #d9a05b', borderRadius: 8 }}
                formatter={(v) => `${fmtMoney(Number(v))} ${f.baseCurrency}`}
              />
              {byEnvelope ? (
                <>
                  <Legend />
                  {envIds.map((id, i) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      name={envNames.get(id) ?? '(видалений конверт)'}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </>
              ) : (
                <Line type="monotone" dataKey="total" name="Разом" stroke="#d9a05b" strokeWidth={3} dot={{ r: 4 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/* ---------------- курси ---------------- */

function Rates({ collection }: { collection: CollectionMeta }) {
  const f = collection.finance!
  const curCol = collection.columns.find((c) => c.id === f.currencyColumnId)
  const codes = (curCol?.options ?? []).map((o) => o.label).filter(Boolean)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const commit = (code: string, raw: string) => {
    const n = Number(raw.replace(',', '.'))
    const rates = { ...f.rates }
    if (raw.trim() === '' || !Number.isFinite(n) || n <= 0) delete rates[code]
    else rates[code] = n
    updateFinanceConfig(collection.id, { rates })
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== code)))
  }

  return (
    <div className="card">
      <h3>Курси валют</h3>
      <p className="muted small-label">
        Приблизні курси до базової валюти. Підсумки рахуються за ними й позначені як «приблизно». Автоматично курси не
        підтягуються.
      </p>
      <label className="field narrow">
        <span>Базова валюта</span>
        <select
          value={f.baseCurrency}
          onChange={(e) => updateFinanceConfig(collection.id, { baseCurrency: e.target.value })}
        >
          {codes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="upd-list">
        {codes
          .filter((c) => c !== f.baseCurrency)
          .map((code) => (
            <label className="upd-row" key={code}>
              <span className="upd-name">1 {code} =</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="курс"
                value={drafts[code] ?? (f.rates[code] ? String(f.rates[code]) : '')}
                onChange={(e) => setDrafts((d) => ({ ...d, [code]: e.target.value }))}
                onBlur={(e) => commit(code, e.target.value)}
              />
              <span className="upd-cur">{f.baseCurrency}</span>
            </label>
          ))}
      </div>
    </div>
  )
}

/* ---------------- інвестиції ---------------- */

const STATUS_TEXT = { upcoming: 'ще не почалась', active: 'триває', finished: 'завершена' } as const

function Investments({ collection, data }: { collection: CollectionMeta; data: CollectionData }) {
  const f = collection.finance!
  const [today] = useState(() => new Date())

  const rows = envelopesOf(collection, data.records)
    .filter((e) => isValidInvestment(e.record.investment))
    .map((e) => ({ e, inv: e.record.investment!, res: calcInvestment(e.record.investment!, e.amount, today) }))

  if (!rows.length) {
    return (
      <p className="muted">
        Інвестицій ще немає. Відкрий конверт і постав позначку «Це інвестиція або депозит», вкажи ставку, дату
        початку й строк.
      </p>
    )
  }

  const expected = totalsOf(rows.map((r) => ({ currency: r.e.currency, amount: r.res.expected })), f.baseCurrency, f.rates)
  const accrued = totalsOf(rows.map((r) => ({ currency: r.e.currency, amount: r.res.accrued })), f.baseCurrency, f.rates)

  return (
    <div className="card">
      <h3>Інвестиції</h3>
      <p className="muted small-label">
        Сума конверта вважається вкладеною. Розрахунок приблизний: без податків і комісій, нараховано пропорційно
        дням.
      </p>
      <div className="fin-by-cur">
        <span className="chip-static">
          Очікуваний дохід: ≈ {fmtMoney(expected.approx)} {f.baseCurrency}
        </span>
        <span className="chip-static">
          Нараховано вже: ≈ {fmtMoney(accrued.approx)} {f.baseCurrency}
        </span>
      </div>
      <div className="table-wrap">
        <table className="records invest-table">
          <thead>
            <tr>
              <th>Конверт</th>
              <th>Вкладено</th>
              <th>Ставка</th>
              <th>Строк</th>
              <th>Закінчення</th>
              <th>Очікуваний дохід</th>
              <th>Нараховано</th>
              <th>Стан</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, inv, res }) => {
              const cur = e.currency || f.baseCurrency
              return (
                <tr key={e.record.id}>
                  <td>
                    <Link to={`/c/${collection.id}/r/${e.record.id}`} className="row-link">
                      {e.name}
                    </Link>
                  </td>
                  <td>
                    {fmtMoney(e.amount)} {cur}
                  </td>
                  <td>
                    {fmtMoney(inv.annualRate)}%<span className="muted"> · {inv.compound ? 'склад.' : 'прості'}</span>
                  </td>
                  <td>{inv.termMonths} міс.</td>
                  <td>{formatDate(res.endDate)}</td>
                  <td>
                    {fmtMoney(res.expected)} {cur}
                  </td>
                  <td>
                    {fmtMoney(res.accrued)} {cur}
                  </td>
                  <td>
                    {STATUS_TEXT[res.status]}
                    {res.status === 'active' && <span className="muted"> · ще {res.daysLeft} дн.</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {(expected.missing.length > 0 || accrued.missing.length > 0) && (
        <p className="error small-label">
          Для частини валют не задано курс ({[...new Set([...expected.missing, ...accrued.missing])].join(', ')}),
          у загальні суми вони не входять.
        </p>
      )}
    </div>
  )
}
