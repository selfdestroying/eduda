'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'sidebar_groups_open_v1'

type State = Record<string, boolean>

function readStorage(): State {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as State
    }
  } catch {
    /* ignore */
  }
  return {}
}

/**
 * Persists user-toggled open/closed state of sidebar groups in localStorage.
 * Returns the current map and a setter. Falsy/missing key means "not toggled" —
 * callers fall back to auto-open-when-active behavior.
 */
export function useGroupOpenState() {
  // Lazy init only runs on client; SSR returns empty object.
  const [state, setState] = useState<State>(readStorage)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* quota exceeded etc — ignore */
    }
  }, [state])

  const setOpen = useCallback((title: string, open: boolean) => {
    setState((prev) => {
      if (prev[title] === open) return prev
      return { ...prev, [title]: open }
    })
  }, [])

  return { state, setOpen } as const
}
