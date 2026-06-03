import type { OrganizationRole } from '@/src/lib/auth/server'
import {
  BarChart3,
  Folder,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { NavGroup, NavLeaf } from './types'
import { isSubGroup } from './types'

/**
 * Discriminated union: a sidebar entry is either a standalone link (leaf)
 * or a collapsible group with sub-items (which may themselves be subgroups).
 */
export type NavEntry = ({ kind: 'leaf' } & NavLeaf) | ({ kind: 'group' } & NavGroup)

const ALL_ROLES: OrganizationRole[] = ['owner', 'manager', 'teacher']
const STAFF_ROLES: OrganizationRole[] = ['owner', 'manager']

/**
 * Single source of truth for sidebar navigation.
 * Order = display order. Roles + featureKey gate visibility.
 */
export const navEntries: NavEntry[] = [
  // ─── Главное ──────────────────────────────────────────────────────────
  {
    kind: 'leaf',
    title: 'Панель управления',
    url: '/',
    icon: LayoutDashboard,
    roles: ALL_ROLES,
  },

  // ─── Ученики ──────────────────────────────────────────────────
  {
    kind: 'group',
    title: 'Ученики',
    icon: Users,
    roles: ALL_ROLES,
    items: [
      {
        title: 'Все ученики',
        url: '/students',
        roles: ALL_ROLES,
        featureKey: 'students.all',
      },
      {
        title: 'Активные',
        url: '/students/active',
        roles: STAFF_ROLES,
        featureKey: 'students.active',
      },
      {
        title: 'Завершившие',
        url: '/students/completed',
        roles: STAFF_ROLES,
        featureKey: 'students.completed',
      },
      {
        title: 'Пропустившие',
        url: '/students/absent',
        roles: STAFF_ROLES,
        featureKey: 'students.absent',
      },
      {
        title: 'Отчисленные',
        url: '/students/dismissed',
        roles: STAFF_ROLES,
        featureKey: 'students.dismissed',
      },
    ],
  },

  // ─── Группы ───────────────────────────────────────────────────────────
  {
    kind: 'group',
    title: 'Группы',
    roles: ALL_ROLES,
    icon: Folder,
    featureKey: 'groups',
    items: [
      {
        title: 'Все группы',
        url: '/groups',
        roles: ALL_ROLES,
        featureKey: 'groups.all',
      },
      {
        title: 'Типы',
        url: '/groups/types',
        roles: STAFF_ROLES,
        featureKey: 'groups.types',
      },
    ],
  },

  // ─── Финансы ──────────────────────────────────────────────────────────
  {
    kind: 'group',
    title: 'Финансы',
    icon: Wallet,
    roles: STAFF_ROLES,
    featureKey: 'finances',
    items: [
      {
        title: 'Оплаты',
        url: '/finances/payments',
        roles: STAFF_ROLES,
        featureKey: 'finances.payments',
      },
      {
        title: 'Неразобранное',
        url: '/finances/unprocessed',
        roles: STAFF_ROLES,
        featureKey: 'finances.unprocessedPayments',
      },
    ],
  },

  // ─── Отчёты ───────────────────────────────────────────────────────────
  {
    kind: 'group',
    title: 'Отчёты',
    icon: BarChart3,
    roles: STAFF_ROLES,
    items: [
      {
        title: 'Зарплаты',
        url: '/finances/salaries/teacher',
        roles: STAFF_ROLES,
        featureKey: 'finances.salaries',
      },
      {
        title: 'Авансы',
        url: '/finances/advances',
        roles: ['owner'],
        featureKey: 'finances.advances',
      },
      {
        title: 'Выручка',
        url: '/finances/revenue',
        roles: ['owner'],
        featureKey: 'finances.revenue',
      },
      {
        title: 'Прибыль',
        url: '/finances/profit',
        roles: ['owner'],
        featureKey: 'finances.profit',
      },
    ],
  },

  // ─── Магазин ──────────────────────────────────────────────────────────
  {
    kind: 'group',
    title: 'Магазин',
    icon: ShoppingCart,
    roles: ALL_ROLES,
    featureKey: 'shop',
    items: [
      {
        title: 'Товары',
        url: '/shop/products',
        roles: ALL_ROLES,
        featureKey: 'shop.products',
      },
      {
        title: 'Категории',
        url: '/shop/categories',
        roles: ALL_ROLES,
        featureKey: 'shop.categories',
      },
      {
        title: 'Заказы',
        url: '/shop/orders',
        roles: ALL_ROLES,
        featureKey: 'shop.orders',
      },
    ],
  },
]

/**
 * Find a human-readable title for a given pathname by walking the nav tree.
 * Falls back to the closest parent route if exact match is missing.
 */
export function findNavTitleByPath(pathname: string): string | undefined {
  const exact = lookupTitle(pathname)
  if (exact) return exact

  // Walk up parent segments
  const segments = pathname.split('/').filter(Boolean)
  while (segments.length > 0) {
    segments.pop()
    const parent = '/' + segments.join('/')
    const found = lookupTitle(parent === '/' && pathname !== '/' ? '/' : parent)
    if (found) return found
  }
  return undefined
}

function lookupTitle(pathname: string): string | undefined {
  for (const entry of navEntries) {
    if (entry.kind === 'leaf' && entry.url === pathname) return entry.title
    if (entry.kind === 'group') {
      if (entry.url === pathname) return entry.title
      for (const child of entry.items) {
        if (isSubGroup(child)) {
          if (child.url === pathname) return child.title
          for (const sub of child.items) {
            if (sub.url === pathname) return sub.title
          }
        } else if (child.url === pathname) {
          return child.title
        }
      }
    }
  }
  return undefined
}

/** Static page-title overrides for routes outside the sidebar (e.g. detail pages). */
const EXTRA_TITLES: Record<string, string> = {
  '/me': 'Профиль',
  '/me/settings': 'Настройки',
  '/me/paychecks': 'Мои чеки',
  '/me/salary': 'Моя зарплата',
  // Organization items live in the brand dropdown, not the sidebar tree.
  '/organization/members': 'Сотрудники',
  '/organization/locations': 'Локации и аренда',
  '/organization/rates': 'Ставки преподавателей',
  '/organization/rates/manager': 'Ставки менеджеров',
  '/organization/tax-systems': 'Налоги',
  '/finances/payment-methods': 'Методы оплаты',
}

export function getPageTitle(pathname: string, fallback = 'ЕДУДА'): string {
  if (EXTRA_TITLES[pathname]) return EXTRA_TITLES[pathname]
  const fromNav = findNavTitleByPath(pathname)
  if (fromNav) return fromNav

  // Fallback: try parent in EXTRA_TITLES too
  const segments = pathname.split('/').filter(Boolean)
  while (segments.length > 0) {
    segments.pop()
    const parent = '/' + segments.join('/')
    if (EXTRA_TITLES[parent]) return EXTRA_TITLES[parent]
  }
  return fallback
}

/** Re-export for components that need the icon type. */
export type { LucideIcon }
