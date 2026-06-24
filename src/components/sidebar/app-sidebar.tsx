'use client'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '@/src/components/ui/sidebar'
import { useSessionQuery } from '@/src/features/users/me/queries'
import { SmartFeedBar } from '@/src/features/smart-feed/components/smart-feed'
import type { OrganizationRole } from '@/src/lib/auth/server'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import NavBrand from './nav-brand'
import NavCollapseButton from './nav-collapse-button'
import NavDocs from './nav-docs'
import NavMain from './nav-main'
import NavUser from './nav-user'

/** Закрывает мобильный сайдбар при смене маршрута */
function CloseSidebarOnNavigate() {
  const pathname = usePathname()
  const { setOpenMobile, isMobile } = useSidebar()

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [pathname, isMobile, setOpenMobile])

  return null
}

export function AppSidebar({
  children,
  defaultOpen,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const { data: session } = useSessionQuery()
  const role = session?.memberRole as OrganizationRole | undefined
  const canSeeFeed = role === 'owner' || role === 'manager'

  return (
    <SidebarProvider defaultOpen={defaultOpen ?? true}>
      <CloseSidebarOnNavigate />
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <NavCollapseButton />
          <NavBrand />
        </SidebarHeader>

        <SidebarContent>
          <NavMain />
        </SidebarContent>

        <SidebarFooter>
          <NavDocs />
          <NavUser />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-transparent">
        <header className="bg-sidebar sticky top-0 z-50 flex h-[var(--sidebar-width-icon)] shrink-0 items-center gap-2 border-b px-4">
          <SmartFeedBar canSeeFeed={canSeeFeed} />
        </header>

        <div className="min-w-0 space-y-2 p-2">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
