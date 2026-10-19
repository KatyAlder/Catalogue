/* Єдина бібліотека кольорових ілюстрацій. SVG підхоплюються автоматично з двох папок:
     src/iconsets/art/<ключ>.svg    ілюстрації колекцій (пляшечка, книжки…)
     src/iconsets/decor/<ключ>.svg  декор (вазони, свічки…)
   Папки лише для порядку: будь-яку ілюстрацію можна і обрати іконкою колекції,
   і поставити на полицю як декор. Якщо ключ є в обох папках, для колекції
   береться версія з art, для декору з decor. */
import { ART_ORDER } from './artLabels'

const byOrder = (keys: string[]): string[] =>
  [...keys].sort((a, b) => {
    const ia = ART_ORDER.indexOf(a)
    const ib = ART_ORDER.indexOf(b)
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
  })

const load = (files: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [path, url] of Object.entries(files)) {
    out[path.split('/').pop()!.replace(/\.svg$/, '')] = url
  }
  return out
}

const art = load(
  import.meta.glob('./iconsets/art/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<
    string,
    string
  >,
)
const decor = load(
  import.meta.glob('./iconsets/decor/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<
    string,
    string
  >,
)

/** Ілюстрація для іконки колекції (art, а якщо немає, то з decor). */
export const artUrl = (key: string): string | undefined => art[key] ?? decor[key]
/** Ілюстрація для декору на полиці (decor, а якщо немає, то з art). */
export const decorUrl = (key: string): string | undefined => decor[key] ?? art[key]

/** Усі ключі, доступні і як іконка колекції, і як декор. */
export const ART_KEYS = byOrder([...new Set([...Object.keys(art), ...Object.keys(decor)])])
/** Для списку декору: спершу предмети з папки decor, потім решта */
export const DECOR_KEYS = [...byOrder(Object.keys(decor)), ...ART_KEYS.filter((k) => !(k in decor))]
