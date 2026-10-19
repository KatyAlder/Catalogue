import { Link } from 'react-router-dom'
import type { Column, RecordItem } from '../data/types'
import type { Group, ViewState } from '../data/view'
import { recordTitle } from '../data/view'
import { setCell } from '../data/recordActions'
import { CellView } from './Cells'

interface Props {
  collectionId: string
  columns: Column[]
  groups: Group[]
  view: ViewState
  onSort: (colId: string) => void
}

const recordLink = (collectionId: string, r: RecordItem) => `/c/${collectionId}/r/${r.id}`

export function RecordsTable({ collectionId, columns, groups, view, onSort }: Props) {
  const visible = columns.filter((c) => c.type !== 'photo')
  return (
    <div className="table-wrap">
      <table className="records">
        <thead>
          <tr>
            {visible.map((c) => (
              <th key={c.id}>
                <button type="button" onClick={() => onSort(c.id)}>
                  {c.name}
                  {view.sortCol === c.id && (view.sortDir === 'asc' ? ' ▲' : ' ▼')}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            {g.label && (
              <tr className="group-row">
                <td colSpan={visible.length}>
                  {g.label} <span className="muted">· {g.records.length}</span>
                </td>
              </tr>
            )}
            {g.records.map((r) => (
              <tr key={r.id}>
                {visible.map((c, i) => (
                  <td key={c.id}>
                    {i === 0 && c.type !== 'progress' ? (
                      <Link to={recordLink(collectionId, r)} className="row-link">
                        <CellView col={c} value={r.values[c.id]} />
                      </Link>
                    ) : (
                      <CellView
                        col={c}
                        value={r.values[c.id]}
                        onProgress={(v) => setCell(collectionId, r.id, c.id, v)}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <p className="hint muted">Натисни на значення в першому стовпці, щоб відкрити запис.</p>
    </div>
  )
}

export function RecordsTiles({ collectionId, columns, groups }: Props) {
  const visible = columns.filter((c) => c.type !== 'photo')
  return (
    <div>
      {groups.map((g) => (
        <section key={g.key}>
          {g.label && (
            <h3 className="group-title">
              {g.label} <span className="muted">· {g.records.length}</span>
            </h3>
          )}
          <div className="tiles">
            {g.records.map((r) => (
              <div className="tile" key={r.id}>
                <Link to={recordLink(collectionId, r)} className="tile-title">
                  {recordTitle(columns, r)}
                </Link>
                <dl>
                  {visible.slice(0, 6).map((c) => (
                    <div key={c.id} className="tile-field">
                      <dt>{c.name}</dt>
                      <dd>
                        <CellView
                          col={c}
                          value={r.values[c.id]}
                          onProgress={(v) => setCell(collectionId, r.id, c.id, v)}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
