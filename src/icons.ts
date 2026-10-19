/* ТИМЧАСОВІ іконки (емодзі). Набір SVG замінить їх на етапі «Шафа та іконки»;
   у даних зберігається лише ключ, тож заміна нічого не ламає. */
export const ICONS: Record<string, { label: string; glyph: string }> = {
  box: { label: 'Коробка', glyph: '📦' },
  bottle: { label: 'Пляшечка', glyph: '🧴' },
  hanger: { label: 'Вішак', glyph: '👗' },
  horseshoe: { label: 'Підкова', glyph: '🐴' },
  lipstick: { label: 'Косметика', glyph: '💄' },
  book: { label: 'Книжка', glyph: '📚' },
  coins: { label: 'Гроші', glyph: '💰' },
  calendar: { label: 'Календар', glyph: '🗓️' },
}

export const iconGlyph = (key: string): string => (ICONS[key] ?? ICONS.box).glyph
