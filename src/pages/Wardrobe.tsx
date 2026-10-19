import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  addDecor,
  addShelf,
  decorKeyOf,
  deleteCollection,
  deleteShelf,
  isDecorId,
  isSpacerId,
  moveItemToSlot,
  moveShelf,
  removeDecor,
  renameShelf,
  setShowShelfNames,
} from '../data/actions'
import { agoText, lastSnapshotDate } from '../data/finance'
import { useAppState } from '../data/store'
import type { CollectionMeta, Shelf } from '../data/types'
import { DECOR_KEYS, artUrl, decorUrl } from '../artIcons'
import { Icon } from '../icons'
import { iconLabel } from '../iconData'
import { labelCss } from '../labelStyle'

const SHELF_PREFIX = 'shelf:'

/** Куди впав предмет: найближча полиця й номер слота на ній (з урахуванням
    рядків, на які полиця переноситься на вузьких екранах). */
function slotAt(cx: number, cy: number): { shelfId: string; slot: number } | null {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-shelf-row]')]
  if (!rows.length) return null
  let best = rows[0]
  let bestDist = Infinity
  for (const r of rows) {
    const b = r.getBoundingClientRect()
    const d = cy < b.top ? b.top - cy : cy > b.bottom ? cy - b.bottom : 0
    if (d < bestDist) {
      bestDist = d
      best = r
    }
  }
  if (bestDist > 140) return null // кинули далеко від шафи: скасувати
  const rb = best.getBoundingClientRect()
  const kids = [...best.children].filter((el): el is HTMLElement => el instanceof HTMLElement && 'item' in el.dataset)
  const cs = getComputedStyle(best)
  const gap = parseFloat(cs.columnGap) || 12
  const padL = parseFloat(cs.paddingLeft) || 0
  const padR = parseFloat(cs.paddingRight) || 0
  const itemW = kids.length ? kids[0].getBoundingClientRect().width : 100
  const slotW = itemW + gap
  const perRow = Math.max(1, Math.floor((rb.width - padL - padR + gap) / slotW))
  const rowTops = [...new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top - rb.top)))].sort((a, b) => a - b)
  const relY = cy - rb.top
  let rowIdx = 0
  rowTops.forEach((t, i) => {
    if (relY >= t - 8) rowIdx = i
  })
  const col = Math.min(perRow - 1, Math.max(0, Math.round((cx - rb.left - padL - itemW / 2) / slotW)))
  return { shelfId: best.dataset.shelfRow!, slot: rowIdx * perRow + col }
}

function Box({
  c,
  caption,
  justDragged,
  editing,
}: {
  c: CollectionMeta
  caption?: string
  justDragged: React.RefObject<boolean>
  editing: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id })
  const navigate = useNavigate()
  const nameEl = (
    <span className="box-name" style={labelCss(c.label)}>
      {c.name}
    </span>
  )
  const isLink = c.module === 'link' && !!c.url
  const className = `box${artUrl(c.icon) ? ' has-art' : ''}`
  const inner = (
    <>
      {c.label?.position === 'above' && nameEl}
      {artUrl(c.icon) ? (
        <img className="box-art" src={artUrl(c.icon)} alt="" draggable={false} />
      ) : (
        <span className="box-icon">
          <Icon name={c.icon} size={40} />
        </span>
      )}
      {c.label?.position !== 'above' && nameEl}
      {caption && <span className="box-caption">{caption}</span>}
    </>
  )
  // клік, що завершує перетягування, не має відкривати колекцію чи ярлик
  const guard = (e: React.MouseEvent) => {
    if (justDragged.current || (isLink && editing)) e.preventDefault()
  }
  return (
    <div
      ref={setNodeRef}
      data-item=""
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="box-wrap"
      {...attributes}
      {...listeners}
    >
      {isLink ? (
        <a
          href={c.url}
          target={c.newTab === false ? undefined : '_blank'}
          rel="noopener noreferrer"
          className={className}
          title={`${c.name}: ${c.url}`}
          draggable={false}
          onClick={guard}
        >
          {inner}
        </a>
      ) : (
        <Link to={`/c/${c.id}`} className={className} title={c.name} draggable={false} onClick={guard}>
          {inner}
        </Link>
      )}
      {isLink && editing && (
        <>
          <button
            className="box-edit"
            aria-label="Змінити ярлик"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => navigate(`/c/${c.id}/edit`)}
          >
            ✎
          </button>
          <button
            className="decor-x"
            aria-label="Видалити ярлик"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (window.confirm(`Видалити ярлик «${c.name}»?`)) deleteCollection(c.id)
            }}
          >
            ✕
          </button>
        </>
      )}
    </div>
  )
}

function Spacer({ id, editing }: { id: string; editing: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      data-item=""
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`spacer-wrap${editing ? ' editing' : ''}`}
      {...attributes}
      {...listeners}
    >
      {editing && (
        <button
          className="decor-x"
          aria-label="Прибрати проміжок"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => removeDecor(id)}
        >
          ✕
        </button>
      )}
    </div>
  )
}

function Decor({ id, editing }: { id: string; editing: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const url = decorUrl(decorKeyOf(id))
  if (!url) return null
  return (
    <div
      ref={setNodeRef}
      data-item=""
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="decor-wrap"
      {...attributes}
      {...listeners}
    >
      <img className="decor" src={url} alt="" draggable={false} />
      {editing && (
        <button
          className="decor-x"
          aria-label="Прибрати декор"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => removeDecor(id)}
        >
          ✕
        </button>
      )}
    </div>
  )
}

function ShelfRow({
  shelf,
  byId,
  captions,
  justDragged,
  editing,
}: {
  shelf: Shelf
  byId: Map<string, CollectionMeta>
  captions: Map<string, string>
  justDragged: React.RefObject<boolean>
  editing: boolean
}) {
  const { setNodeRef } = useDroppable({ id: SHELF_PREFIX + shelf.id })
  return (
    <SortableContext items={shelf.collectionIds} strategy={rectSortingStrategy}>
      <div className="shelf-row" ref={setNodeRef} data-shelf-row={shelf.id}>
        {shelf.collectionIds.every(isSpacerId) && <span className="empty">Полиця порожня</span>}
        {shelf.collectionIds.map((id) => {
          if (isSpacerId(id)) return <Spacer key={id} id={id} editing={editing} />
          if (isDecorId(id)) return <Decor key={id} id={id} editing={editing} />
          const c = byId.get(id)
          return c ? <Box key={id} c={c} caption={captions.get(id)} justDragged={justDragged} editing={editing} /> : null
        })}
      </div>
    </SortableContext>
  )
}

export default function Wardrobe() {
  const { db } = useAppState()
  const { collections, settings } = db.index
  const [editing, setEditing] = useState(false)
  const [decorShelf, setDecorShelf] = useState('')
  const justDragged = useRef(false)
  const byId = new Map(collections.map((c) => [c.id, c]))
  // м’яка позначка для «Фінансів»: без сповіщень, лише підпис на іконці
  const captions = new Map<string, string>()
  for (const c of collections) {
    if (c.module !== 'finance') continue
    const last = lastSnapshotDate(db.collections[c.id]?.snapshots ?? [])
    captions.set(c.id, last ? agoText(last) : 'ще не оновлено')
  }
  const shelves = [...db.index.shelves].sort(
    (a, b) => (a.order ?? db.index.shelves.indexOf(a)) - (b.order ?? db.index.shelves.indexOf(b)),
  )

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    // клік, що завершує перетягування, має проігноруватися (іконка може опинитись під курсором)
    justDragged.current = true
    setTimeout(() => (justDragged.current = false), 300)
    // місце визначаємо за положенням іконки, а не за найближчим сусідом:
    // так предмет можна поставити у вільне місце полиці
    const rect = e.active.rect.current.translated
    if (!rect) return
    const target = slotAt(rect.left + rect.width / 2, rect.top + rect.height / 2)
    if (target) moveItemToSlot(String(e.active.id), target.shelfId, target.slot)
  }

  return (
    <>
      <div className="toolbar">
        <Link to="/new" className="btn">
          + Нова колекція
        </Link>
        <button className="btn ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Готово' : 'Полиці'}
        </button>
      </div>

      {editing && (
        <div className="card shelf-edit">
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showShelfNames}
              onChange={(e) => setShowShelfNames(e.target.checked)}
            />
            <span>Показувати назви полиць у шафі</span>
          </label>
          {shelves.map((s, i) => (
            <div className="shelf-edit-row" key={s.id}>
              <input value={s.name} onChange={(e) => renameShelf(s.id, e.target.value)} aria-label="Назва полиці" />
              <button className="icon-btn" onClick={() => moveShelf(s.id, -1)} disabled={i === 0} aria-label="Вище">
                ↑
              </button>
              <button
                className="icon-btn"
                onClick={() => moveShelf(s.id, 1)}
                disabled={i === shelves.length - 1}
                aria-label="Нижче"
              >
                ↓
              </button>
              <button
                className="icon-btn danger"
                onClick={() => deleteShelf(s.id)}
                disabled={s.collectionIds.some((x) => !isSpacerId(x))}
                title={s.collectionIds.some((x) => !isSpacerId(x)) ? 'Спершу прибери або перенеси колекції й декор' : 'Видалити полицю'}
                aria-label="Видалити полицю"
              >
                ✕
              </button>
            </div>
          ))}
          <button className="btn ghost small" onClick={() => addShelf('')}>
            + Полиця
          </button>

          {DECOR_KEYS.length > 0 && (
            <div className="decor-picker">
              <h3>Декор</h3>
              <label className="inline">
                Поставити на полицю
                <select value={decorShelf || shelves[0]?.id} onChange={(e) => setDecorShelf(e.target.value)}>
                  {shelves.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="decor-grid">
                {DECOR_KEYS.map((k) => (
                  <button key={k} className="decor-pick" title={iconLabel(k)} onClick={() => addDecor(decorShelf || shelves[0].id, k)}>
                    <img src={decorUrl(k)} alt={iconLabel(k)} width={48} height={48} draggable={false} />
                  </button>
                ))}
              </div>
              <p className="muted small-label">Декор можна перетягувати, як колекції. Прибрати: хрестик на предметі.</p>
            </div>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => {
          // клік після перетягування може прийти до onDragEnd, тож прапорець ставимо вже на старті
          justDragged.current = true
        }}
        onDragCancel={() => setTimeout(() => (justDragged.current = false), 300)}
        onDragEnd={onDragEnd}
      >
        <main className="wardrobe">
          <div className="cabinet-inner">
            {shelves.map((shelf) => (
              <section key={shelf.id} className="shelf">
                {settings.showShelfNames && <h2>{shelf.name}</h2>}
                <ShelfRow shelf={shelf} byId={byId} captions={captions} justDragged={justDragged} editing={editing} />
              </section>
            ))}
          </div>
        </main>
      </DndContext>
    </>
  )
}
