/**
 * Feature registry - source of truth for all toggleable features.
 * DB stores only overrides (disabled features). By default everything is enabled.
 *
 * Единственный источник истины: помимо каталога (label/parent) каждая запись
 * несёт `routes` — префиксы путей (без /[slug]), которые гейтит фича. Роут-таблица
 * и типизация `featureKey` в навигации выводятся отсюда.
 */

export const FEATURE_KEYS = [
  'students',
  'students.active',
  'students.completed',
  'students.absent',
  'students.dismissed',
  'groups',
  'groups.types',
  'finances',
  'finances.payments',
  'finances.unprocessedPayments',
  'finances.revenue',
  'finances.salaries',
  'finances.managerSalaries',
  'finances.advances',
  'finances.rent',
  'finances.paymentMethods',
  'finances.profit',
  'finances.profitMonthly',
  'shop',
  'shop.products',
  'shop.categories',
  'shop.orders',
  'organization.rates',
  'organization.courses',
  'organization.locations',
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

type FeatureEntry = {
  label: string
  description?: string
  parent?: FeatureKey
  /** Префиксы путей (без /[slug]), которые гейтит фича. */
  routes?: string[]
}

export const FEATURE_REGISTRY: Record<FeatureKey, FeatureEntry> = {
  // - Ученики -
  students: { label: 'Ученики', routes: ['/students'] },
  'students.active': { label: 'Активные', parent: 'students', routes: ['/students/active'] },
  'students.completed': {
    label: 'Завершившие',
    parent: 'students',
    routes: ['/students/completed'],
  },
  'students.absent': { label: 'Пропустившие', parent: 'students', routes: ['/students/absent'] },
  'students.dismissed': {
    label: 'Отчисленные',
    parent: 'students',
    routes: ['/students/dismissed'],
  },

  // - Группы -
  groups: { label: 'Группы', routes: ['/groups'] },
  'groups.types': { label: 'Типы групп', parent: 'groups', routes: ['/groups/types'] },

  // - Финансы -
  finances: { label: 'Финансы', routes: ['/finances'] },
  'finances.payments': { label: 'Оплаты', parent: 'finances', routes: ['/finances/payments'] },
  'finances.revenue': { label: 'Выручка', parent: 'finances', routes: ['/finances/revenue'] },
  'finances.advances': { label: 'Авансы', parent: 'finances', routes: ['/finances/advances'] },
  // Под-тумблер учёта аренды: страницы нет (показывается внутри локаций), потому без routes.
  'finances.rent': { label: 'Аренда', parent: 'finances' },
  'finances.salaries': { label: 'Зарплаты', parent: 'finances', routes: ['/finances/salaries'] },
  'finances.managerSalaries': {
    label: 'Ставки менеджеров',
    parent: 'finances',
    routes: ['/finances/manager-salaries'],
  },
  'finances.unprocessedPayments': {
    label: 'Неразобранное',
    parent: 'finances',
    routes: ['/finances/unprocessed'],
  },
  'finances.paymentMethods': {
    label: 'Методы оплаты',
    parent: 'finances',
    routes: ['/finances/payment-methods'],
  },
  'finances.profit': { label: 'Прибыль', parent: 'finances', routes: ['/finances/profit'] },
  'finances.profitMonthly': {
    label: 'Прибыль по месяцам',
    parent: 'finances',
    routes: ['/finances/profit-monthly'],
  },

  // - Магазин -
  shop: { label: 'Магазин', routes: ['/shop'] },
  'shop.products': { label: 'Товары', parent: 'shop', routes: ['/shop/products'] },
  'shop.categories': { label: 'Категории', parent: 'shop', routes: ['/shop/categories'] },
  'shop.orders': { label: 'Заказы', parent: 'shop', routes: ['/shop/orders'] },

  // - Школа (подстраницы) -
  'organization.rates': { label: 'Ставки', routes: ['/organization/rates'] },
  'organization.courses': { label: 'Курсы', routes: ['/organization/courses'] },
  'organization.locations': { label: 'Локации', routes: ['/organization/locations'] },
}

/** Get all child feature keys for a parent */
export function getChildFeatures(parentKey: FeatureKey): FeatureKey[] {
  return FEATURE_KEYS.filter((key) => FEATURE_REGISTRY[key].parent === parentKey)
}

/** Get all top-level (parentless) feature keys */
export function getRootFeatures(): FeatureKey[] {
  return FEATURE_KEYS.filter((key) => !FEATURE_REGISTRY[key].parent)
}

/**
 * Check if a feature is disabled, considering parent hierarchy.
 * A feature is disabled if it's explicitly in the list OR its parent is.
 */
export function isFeatureDisabled(disabledFeatures: string[], featureKey: string): boolean {
  if (disabledFeatures.includes(featureKey)) return true

  const entry = FEATURE_REGISTRY[featureKey as FeatureKey]
  if (entry?.parent && disabledFeatures.includes(entry.parent)) return true

  return false
}

/**
 * Роут-таблица «префикс пути → feature key», выведенная из `FEATURE_REGISTRY`.
 * Порядок больше не ведётся руками: сортируем по длине префикса (длинный — первым),
 * чтобы более специфичный путь (`/finances/profit-monthly`) выигрывал у общего
 * (`/finances/profit`).
 */
const ROUTE_TABLE: [string, FeatureKey][] = (
  Object.entries(FEATURE_REGISTRY) as [FeatureKey, (typeof FEATURE_REGISTRY)[FeatureKey]][]
)
  .flatMap(([key, entry]) =>
    (entry.routes ?? []).map((route) => [route, key] as [string, FeatureKey]),
  )
  .sort((a, b) => b[0].length - a[0].length)

/** Resolve the feature key for a given pathname (without the /[slug] prefix) */
export function getFeatureKeyForRoute(pathname: string): FeatureKey | null {
  for (const [route, featureKey] of ROUTE_TABLE) {
    if (pathname.startsWith(route)) return featureKey
  }
  return null
}

/** Check if a route is blocked because its feature is disabled */
export function isRouteDisabled(pathname: string, disabledFeatures: string[]): boolean {
  if (disabledFeatures.length === 0) return false

  const featureKey = getFeatureKeyForRoute(pathname)
  if (!featureKey) return false

  return isFeatureDisabled(disabledFeatures, featureKey)
}
