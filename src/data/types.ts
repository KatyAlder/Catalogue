export type ColumnType =
  | 'text'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'link'
  | 'date'
  | 'progress'
  | 'photo'

export interface SelectOption {
  id: string
  label: string
  color?: string
}

export interface Column {
  id: string
  name: string
  type: ColumnType
  options?: SelectOption[] // select
  step?: number // progress, за замовчуванням 10
}

/** Необов’язкові модулі колекції. Звичайні колекції мають 'none'. */
/** 'link': не колекція, а ярлик на шафі, що відкриває посилання (інший додаток, сайт) */
export type CollectionModule = 'none' | 'tracker' | 'finance' | 'link'

export interface TrackerConfig {
  dateColumnId: string
  statusColumnId: string
}

export interface FinanceConfig {
  /** Які стовпці колекції відповідають за назву, суму й валюту конверта */
  nameColumnId: string
  amountColumnId: string
  currencyColumnId: string
  /** Код базової валюти, збігається з підписом варіанта у стовпці валюти */
  baseCurrency: string
  /** Приблизні курси до базової валюти: { USD: 41.5 } */
  rates: Record<string, number>
}

/** Вигляд підпису колекції на шафі; відсутні поля = значення за замовчуванням */
export interface LabelStyle {
  position?: 'below' | 'above'
  font?: string // ключ зі списку LABEL_FONTS
  size?: number // px
  color?: string // #rrggbb
}

export interface CollectionMeta {
  id: string
  name: string
  icon: string
  module: CollectionModule
  columns: Column[]
  tracker?: TrackerConfig
  finance?: FinanceConfig
  label?: LabelStyle
  /** Лише для module 'link' */
  url?: string
  newTab?: boolean // за замовчуванням true
  createdAt: number
  updatedAt: number
}

/** Інвестиційні поля конверта: сума конверта вважається вкладеною сумою. */
export interface Investment {
  annualRate: number // річна ставка, %
  startDate: string // YYYY-MM-DD
  termMonths: number
  /** true — складні відсотки з щомісячною капіталізацією, інакше прості */
  compound?: boolean
}

export type CellValue = string | number | boolean | null

/** Рахунок у «Фінансах»: гаманець (гроші на витрати) або конверт (відкладені). Без поля — конверт. */
export type AccountKind = 'wallet' | 'envelope'

export interface RecordItem {
  id: string
  values: Record<string, CellValue>
  kind?: AccountKind
  /** Інвестиційні поля закладені в модель, UI — наступний етап */
  investment?: Investment
  createdAt: number
  updatedAt: number
}

/** Знімок «Фінансів»: створюється лише явною дією «Зберегти оновлення» */
export interface Snapshot {
  id: string
  date: string // YYYY-MM-DD
  amounts: Record<string, number> // recordId -> сума
  /** Валюта конверта на момент знімка: recordId -> код */
  currencies?: Record<string, string>
  updatedAt: number
}

/** Операція «Фінансів». Журнал веде лише значущі події, не щоденні витрати.
    income: надходження на accountId (amount у валюті рахунку);
    transfer: з fromId на toId (amount у валюті відправника, toAmount у валюті отримувача);
    adjust: «зміна» accountId після швидкого оновлення (amount зі знаком). */
export type OperationType = 'income' | 'transfer' | 'adjust'

export interface Operation {
  id: string
  date: string // YYYY-MM-DD
  type: OperationType
  accountId?: string
  fromId?: string
  toId?: string
  amount: number
  currency: string
  toAmount?: number
  toCurrency?: string
  source?: string
  note?: string
  updatedAt: number
}

/** Квартальний аудит: очікувані надходження й фіксовані витрати */
export type AuditFreq = 'month' | 'quarter' | 'once'

export interface AuditLine {
  id: string
  name: string
  amount: number
  currency: string
  freq: AuditFreq
  when?: string
}

export interface Audit {
  id: string
  date: string // YYYY-MM-DD
  incomes: AuditLine[]
  expenses: AuditLine[]
  note: string
  updatedAt: number
}

export interface CollectionData {
  id: string
  records: RecordItem[]
  snapshots: Snapshot[]
  operations?: Operation[]
  audits?: Audit[]
  deleted: Record<string, number> // id -> час видалення
}

export interface Shelf {
  id: string
  name: string
  collectionIds: string[]
  isTrackerShelf?: boolean
  /** Порядок полиць; за відсутності — порядок у масиві */
  order?: number
  updatedAt: number
}

export interface Settings {
  showShelfNames: boolean
  updatedAt: number
}

export interface IndexData {
  version: 1
  shelves: Shelf[]
  collections: CollectionMeta[]
  settings: Settings
  deleted: Record<string, number>
}

export interface LocalDB {
  index: IndexData
  collections: Record<string, CollectionData>
}

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
