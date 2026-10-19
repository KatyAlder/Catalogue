import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
  addShelf,
  deleteShelf,
  moveCollection,
  moveShelf,
  renameShelf,
  setShowShelfNames,
} from '../data/actions'
import { agoText, lastSnapshotDate } from '../data/finance'
import { useAppState } from '../data/store'
import type { CollectionMeta, Shelf } from '../data/types'
import { artUrl } from '../artIcons'
import { Icon } from '../icons'

const SHELF_PREFIX = 'shelf:'

function Box({
  c,
  caption,
  justDragged,
}: {
  c: CollectionMeta
  caption?: string
  justDragged: React.RefObject<boolean>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="box-wrap"
      {...attributes}
      {...listeners}
    >
      <Link
        to={`/c/${c.id}`}
        className={`box${artUrl(c.icon) ? ' has-art' : ''}`}
        title={c.name}
        draggable={false}
        onClick={(e) => {
          // клік, що завершує перетягування, не має відкривати колекцію
          if (justDragged.current) e.preventDefault()
        }}
      >
        {artUrl(c.icon) ? (
          <img className="box-art" src={artUrl(c.icon)} alt="" draggable={false} />
        ) : (
          <span className="box-icon">
            <Icon name={c.icon} size={40} />
          </span>
        )}
        <span className="box-name">{c.name}</span>
        {caption && <span className="box-caption">{caption}</span>}
      </Link>
    </div>
  )
}

function ShelfRow({
  shelf,
  byId,
  captions,
  justDragged,
}: {
  shelf: Shelf
  byId: Map<string, CollectionMeta>
  captions: Map<string, string>
  justDragged: React.RefObject<boolean>
}) {
  const { setNodeRef } = useDroppable({ id: SHELF_PREFIX + shelf.id })
  return (
    <SortableContext items={shelf.collectionIds} strategy={rectSortingStrategy}>
      <div className="shelf-row" ref={setNodeRef}>
        {shelf.collectionIds.length === 0 && <span className="empty">Полиця порожня</span>}
        {shelf.collectionIds.map((id) => {
          const c = byId.get(id)
          return c ? <Box key={id} c={c} caption={captions.get(id)} justDragged={justDragged} /> : null
        })}
      </div>
    </SortableContext>
  )
}

export default function Wardrobe() {
  const { db } = useAppState()
  const { collections, settings } = db.index
  const [editing, setEditing] = useState(false)
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
    justDragged.current = true
    setTimeout(() => (justDragged.current = false), 0)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const overId = String(over.id)
    if (overId.startsWith(SHELF_PREFIX)) {
      moveCollection(String(active.id), overId.slice(SHELF_PREFIX.length), null)
    } else {
      const dest = shelves.find((s) => s.collectionIds.includes(overId))
      if (dest) moveCollection(String(active.id), dest.id, overId)
    }
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
                disabled={s.collectionIds.length > 0}
                title={s.collectionIds.length ? 'Спершу перенеси колекції з полиці' : 'Видалити полицю'}
                aria-label="Видалити полицю"
              >
                ✕
              </button>
            </div>
          ))}
          <button className="btn ghost small" onClick={() => addShelf('')}>
            + Полиця
          </button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <main className="wardrobe">
          <div className="cabinet-inner">
            {shelves.map((shelf) => (
              <section key={shelf.id} className="shelf">
                {settings.showShelfNames && <h2>{shelf.name}</h2>}
                <ShelfRow shelf={shelf} byId={byId} captions={captions} justDragged={justDragged} />
              </section>
            ))}
          </div>
        </main>
      </DndContext>
    </>
  )
}
