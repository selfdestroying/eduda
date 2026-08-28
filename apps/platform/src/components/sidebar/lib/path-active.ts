import { navEntries } from './nav-config'
import type { NavGroup, NavSubGroup } from './types'
import { isSubGroup } from './types'

/** Путь либо сам пункт, либо лежит внутри него. */
const isUnder = (pathname: string, url: string) =>
  pathname === url || pathname.startsWith(url + '/')

/**
 * Все адреса меню плоским списком — чтобы у вложенного пути было с чем сверить
 * точность. Список статический (роли и фичи его не режут): подсветка — чистая
 * функция от пути, а страница, закрытая для роли, до сайдбара и не доходит.
 */
const NAV_URLS: string[] = navEntries.flatMap((entry) =>
  entry.kind === 'leaf'
    ? [entry.url]
    : [
        ...(entry.url ? [entry.url] : []),
        ...entry.items.flatMap((child) =>
          isSubGroup(child)
            ? [...(child.url ? [child.url] : []), ...child.items.map((item) => item.url)]
            : [child.url],
        ),
      ],
)

/**
 * Подсвечен ли пункт меню. Точное совпадение — всегда; вложенный путь — только
 * если в меню нет пункта поточнее.
 *
 * Без последней оговорки один `startsWith` не отличал `/students/123` (карточка
 * ученика, своего пункта нет — светит «Все ученики») от `/students/active`
 * (соседний пункт того же меню), и «Все ученики» горели вместе с «Активными».
 */
export function isPathActive(pathname: string, url: string): boolean {
  if (url === '/') return pathname === '/'
  if (pathname === url) return true
  if (!isUnder(pathname, url)) return false
  return !NAV_URLS.some((other) => other.length > url.length && isUnder(pathname, other))
}

/**
 * Subgroup is "active" when the current pathname matches its landing url
 * or any of its sub-items.
 */
export function isSubGroupActive(sg: NavSubGroup, pathname: string): boolean {
  if (sg.url && isPathActive(pathname, sg.url)) return true
  return sg.items.some((item) => isPathActive(pathname, item.url))
}

/**
 * Group is "active" when the current pathname matches its landing url,
 * any of its direct sub-items, or any item inside one of its subgroups.
 */
export function isGroupActive(group: NavGroup, pathname: string): boolean {
  if (group.url && isPathActive(pathname, group.url)) return true
  return group.items.some((child) =>
    isSubGroup(child) ? isSubGroupActive(child, pathname) : isPathActive(pathname, child.url),
  )
}

export function isLeafActive(leafUrl: string, pathname: string): boolean {
  return isPathActive(pathname, leafUrl)
}
