import { artUrl } from './artIcons'
import { PATHS } from './iconData'

/* SVG-іконка колекції: колір береться з currentColor. */
export function Icon({
  name,
  size = 24,
  className,
  preferArt,
}: {
  name: string
  size?: number
  className?: string
  /** Показати кольорову ілюстрацію, якщо вона є (вибір іконки у формі) */
  preferArt?: boolean
}) {
  const url = artUrl(name)
  if (url && (preferArt || !PATHS[name])) {
    return <img src={url} width={size} height={size} alt="" aria-hidden="true" draggable={false} className={className} />
  }
  const p = PATHS[name] ?? PATHS.box
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {p.d.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
