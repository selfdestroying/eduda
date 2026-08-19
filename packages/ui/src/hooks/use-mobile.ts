import * as React from 'react'

const MOBILE_BREAKPOINT = 768

/**
 * Подписка на media query. `useSyncExternalStore`, а не `useEffect` с состоянием:
 * у него есть отдельный серверный снимок, поэтому разметка при гидрации совпадает
 * и первый клиентский рендер не «прыгает» дважды.
 *
 * На сервере ширины нет, и снимок там всегда `false` — то есть верстать надо от
 * узкого экрана, а широкий считать улучшением.
 *
 * @example
 * const isWide = useMediaQuery('(min-width: 1440px)')
 */
export function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', callback)
      return () => mql.removeEventListener('change', callback)
    },
    [query],
  )

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
}
