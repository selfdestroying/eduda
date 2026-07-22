'use client'

import { useFilteredNav } from './lib/use-filtered-nav'
import NavList from './nav-list'

/**
 * Top-level sidebar navigation: search + filtered list of all nav entries.
 * Replaces the previous nav-platform + nav-shop split.
 */
export default function NavMain() {
  const { entries, isLoading } = useFilteredNav()

  return (
    <>
      <NavList entries={entries} isLoading={isLoading} />
    </>
  )
}
