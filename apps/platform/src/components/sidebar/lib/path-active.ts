import type { NavGroup, NavSubGroup } from './types'
import { isSubGroup } from './types'

/** Match exact path or any nested sub-path. Special-cased for root '/'. */
export function isPathActive(pathname: string, url: string): boolean {
  if (url === '/') return pathname === '/'
  if (pathname === url) return true
  return pathname.startsWith(url + '/')
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
