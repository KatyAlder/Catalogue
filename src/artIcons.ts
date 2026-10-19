/* Кольорові ілюстрації колекцій для головного екрана (шафа).
   Кладеш SVG у src/iconsets/art/<ключ>.svg: вони підхоплюються автоматично.
   Ключ збігається з ключем лінійної іконки (bottle, book…), тож на шафі
   показується ілюстрація, а в списках і формах лишається лінійна. */
const files = import.meta.glob('./iconsets/art/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const art: Record<string, string> = {}
for (const [path, url] of Object.entries(files)) {
  const key = path.split('/').pop()!.replace(/\.svg$/, '')
  art[key] = url
}

/* Декор шафи (вазони, свічки тощо): SVG у src/iconsets/decor/<ключ>.svg.
   Не колекції: нікуди не ведуть, лише стоять на полицях. */
const decorFiles = import.meta.glob('./iconsets/decor/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const decor: Record<string, string> = {}
for (const [path, url] of Object.entries(decorFiles)) {
  decor[path.split('/').pop()!.replace(/\.svg$/, '')] = url
}

export const DECOR_KEYS = Object.keys(decor)
export const decorUrl = (key: string): string | undefined => decor[key]

export const ART_KEYS = Object.keys(art)
export const artUrl = (key: string): string | undefined => art[key]
