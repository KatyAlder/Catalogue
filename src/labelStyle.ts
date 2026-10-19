import type { CSSProperties } from 'react'
import type { LabelStyle } from './data/types'

/* Шрифти підписів. Вбудовані через @fontsource (кирилиця є), тому однаково
   виглядають на всіх пристроях і не вантажаться з чужих серверів. */
export const LABEL_FONTS: Record<string, { label: string; family: string }> = {
  default: { label: 'Звичайний', family: 'system-ui, \'Segoe UI\', Roboto, sans-serif' },
  playfair: { label: 'Антиква (Playfair)', family: '\'Playfair Display\', Georgia, serif' },
  lora: { label: 'Книжковий (Lora)', family: 'Lora, Georgia, serif' },
  caveat: { label: 'Рукописний (Caveat)', family: 'Caveat, cursive' },
  marck: { label: 'Каліграфія (Marck Script)', family: '\'Marck Script\', cursive' },
  mono: { label: 'Друкарська машинка (PT Mono)', family: '\'PT Mono\', monospace' },
}

export const LABEL_DEFAULTS = { position: 'below', font: 'default', size: 12 } as const
export const LABEL_SIZE_MIN = 10
export const LABEL_SIZE_MAX = 22

export function labelCss(l: LabelStyle | undefined): CSSProperties {
  const font = LABEL_FONTS[l?.font ?? 'default'] ?? LABEL_FONTS.default
  // рукописні шрифти дрібніші за звичайні при тому ж розмірі: трохи збільшуємо
  const boost = l?.font === 'caveat' || l?.font === 'marck' ? 1.2 : 1
  return {
    fontFamily: font.family,
    fontSize: `${Math.round((l?.size ?? LABEL_DEFAULTS.size) * boost * 10) / 10}px`,
    ...(l?.color ? { color: l.color } : {}),
  }
}

/** Прибирає значення за замовчуванням, щоб у даних лежало лише змінене. */
export function compactLabel(l: LabelStyle): LabelStyle | undefined {
  const out: LabelStyle = {}
  if (l.position && l.position !== LABEL_DEFAULTS.position) out.position = l.position
  if (l.font && l.font !== LABEL_DEFAULTS.font) out.font = l.font
  if (l.size && l.size !== LABEL_DEFAULTS.size) out.size = l.size
  if (l.color) out.color = l.color
  return Object.keys(out).length ? out : undefined
}
