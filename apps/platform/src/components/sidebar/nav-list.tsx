'use client'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/src/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/src/components/ui/sidebar'
import { Skeleton } from '@/src/components/ui/skeleton'
import { ChevronRight, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'
import type { NavEntry } from './lib/nav-config'
import { isGroupActive, isPathActive, isSubGroupActive } from './lib/path-active'
import type { NavSubGroup } from './lib/types'
import { isSubGroup } from './lib/types'
import { useGroupOpenState } from './lib/use-group-open-state'

type OpenState = Record<string, boolean>
type SetOpenFn = (title: string, open: boolean) => void

interface NavListProps {
  entries: NavEntry[]
  /** When true (e.g. search is active) every group is rendered open. */
  forceOpen?: boolean
  isLoading?: boolean
  /** Empty-state content rendered when entries is empty after loading. */
  emptyHint?: React.ReactNode
}

export default function NavList({ entries, forceOpen, isLoading, emptyHint }: NavListProps) {
  const pathname = usePathname()
  const { state: openState, setOpen } = useGroupOpenState()
  const { state: sidebarState, isMobile } = useSidebar()
  const isCollapsed = sidebarState === 'collapsed' && !isMobile

  if (isLoading) return <NavListSkeleton />

  if (entries.length === 0) {
    return emptyHint ? (
      <SidebarGroup>
        <div className="text-muted-foreground px-2 py-1 text-xs group-data-[collapsible=icon]:hidden">
          {emptyHint}
        </div>
      </SidebarGroup>
    ) : null
  }

  return (
    <>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === '/'} render={<Link href={'/'} />}>
              <LayoutDashboard />
              <span>Панель управления</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarMenu>
          {entries.map((entry) => {
            if (entry.kind === 'leaf') {
              return null
            }

            const groupActive = isGroupActive(entry, pathname)
            const userOverride = openState[entry.title]
            const open =
              forceOpen === true
                ? true
                : typeof userOverride === 'boolean'
                  ? userOverride
                  : groupActive

            return (
              <NavGroupItem
                key={entry.title}
                entry={entry}
                pathname={pathname}
                open={open}
                onOpenChange={(o) => setOpen(entry.title, o)}
                isCollapsed={isCollapsed}
                groupActive={groupActive}
                forceOpen={forceOpen === true}
                openState={openState}
                setOpen={setOpen}
              />
            )
          })}
        </SidebarMenu>
      </SidebarGroup>
    </>
  )
}

// ─── Group ────────────────────────────────────────────────────────────

type GroupEntry = Extract<NavEntry, { kind: 'group' }>

function NavGroupItem({
  entry,
  pathname,
  open,
  onOpenChange,
  isCollapsed,
  groupActive,
  forceOpen,
  openState,
  setOpen,
}: {
  entry: GroupEntry
  pathname: string
  open: boolean
  onOpenChange: (open: boolean) => void
  isCollapsed: boolean
  groupActive: boolean
  forceOpen: boolean
  openState: OpenState
  setOpen: SetOpenFn
}) {
  // Group with url but no remaining items renders as a simple link.
  if (entry.items.length === 0 && entry.url) {
    const Icon = entry.icon
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isPathActive(pathname, entry.url)}
          render={<Link href={entry.url} />}
          tooltip={entry.title}
        >
          <Icon />
          <span>{entry.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  if (isCollapsed) {
    return <NavGroupCollapsed entry={entry} pathname={pathname} groupActive={groupActive} />
  }
  return (
    <NavGroupExpanded
      entry={entry}
      pathname={pathname}
      open={open}
      onOpenChange={onOpenChange}
      groupActive={groupActive}
      forceOpen={forceOpen}
      openState={openState}
      setOpen={setOpen}
    />
  )
}

function NavGroupExpanded({
  entry,
  pathname,
  open,
  onOpenChange,
  groupActive,
  forceOpen,
  openState,
  setOpen,
}: {
  entry: GroupEntry
  pathname: string
  open: boolean
  onOpenChange: (open: boolean) => void
  groupActive: boolean
  forceOpen: boolean
  openState: OpenState
  setOpen: SetOpenFn
}) {
  const Icon = entry.icon
  const headerLabel = (
    <>
      <Icon />
      <span>{entry.title}</span>
    </>
  )

  return (
    <Collapsible
      render={<SidebarMenuItem />}
      open={open}
      onOpenChange={onOpenChange}
      className="group/collapsible"
    >
      {entry.url ? (
        <>
          <SidebarMenuButton
            isActive={groupActive}
            render={<Link href={entry.url} />}
            tooltip={entry.title}
          >
            {headerLabel}
          </SidebarMenuButton>
          <CollapsibleTrigger
            render={
              <SidebarMenuAction className="transition-transform data-[state=open]:rotate-90" />
            }
          >
            <ChevronRight />
            <span className="sr-only">{open ? 'Свернуть подменю' : 'Развернуть подменю'}</span>
          </CollapsibleTrigger>
        </>
      ) : (
        <CollapsibleTrigger
          render={<SidebarMenuButton tooltip={entry.title} isActive={groupActive} />}
        >
          {headerLabel}
          <ChevronRight className="ml-auto transition-transform group-data-open/collapsible:rotate-90" />
        </CollapsibleTrigger>
      )}
      <CollapsibleContent>
        <SidebarMenuSub>
          {entry.items.map((child) => {
            if (isSubGroup(child)) {
              const subActive = isSubGroupActive(child, pathname)
              const subKey = `${entry.title} / ${child.title}`
              const subOverride = openState[subKey]
              const subOpen = forceOpen
                ? true
                : typeof subOverride === 'boolean'
                  ? subOverride
                  : subActive
              return (
                <SubGroupExpanded
                  key={subKey}
                  sg={child}
                  pathname={pathname}
                  open={subOpen}
                  onOpenChange={(o) => setOpen(subKey, o)}
                  active={subActive}
                />
              )
            }
            return (
              <SidebarMenuSubItem key={child.url}>
                <SidebarMenuSubButton
                  isActive={isPathActive(pathname, child.url)}
                  render={<Link href={child.url} />}
                >
                  <span>{child.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Sub-group (second level, expanded sidebar only) ──────────────────

function SubGroupExpanded({
  sg,
  pathname,
  open,
  onOpenChange,
  active,
}: {
  sg: NavSubGroup
  pathname: string
  open: boolean
  onOpenChange: (open: boolean) => void
  active: boolean
}) {
  return (
    <Collapsible
      render={<SidebarMenuSubItem />}
      open={open}
      onOpenChange={onOpenChange}
      className="group/sub-collapsible"
    >
      {sg.url ? (
        <>
          <SidebarMenuSubButton isActive={active} render={<Link href={sg.url} />}>
            <span>{sg.title}</span>
          </SidebarMenuSubButton>
          <CollapsibleTrigger
            className="hover:bg-sidebar-accent absolute top-1 right-1 z-10 flex size-5 items-center justify-center rounded-sm transition-transform data-[state=open]:rotate-90"
            aria-label={open ? 'Свернуть подменю' : 'Развернуть подменю'}
          >
            <ChevronRight className="size-3.5" />
          </CollapsibleTrigger>
        </>
      ) : (
        <CollapsibleTrigger render={<SidebarMenuSubButton isActive={active} />}>
          <span>{sg.title}</span>
          <ChevronRight className="ml-auto size-3.5 transition-transform group-data-open/sub-collapsible:rotate-90" />
        </CollapsibleTrigger>
      )}
      <CollapsibleContent>
        <SidebarMenuSub>
          {sg.items.map((item) => (
            <SidebarMenuSubItem key={item.url}>
              <SidebarMenuSubButton
                isActive={isPathActive(pathname, item.url)}
                render={<Link href={item.url} />}
              >
                <span>{item.title}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

function NavGroupCollapsed({
  entry,
  pathname,
  groupActive,
}: {
  entry: GroupEntry
  pathname: string
  groupActive: boolean
}) {
  const Icon = entry.icon
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              isActive={groupActive}
              tooltip={entry.title}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            />
          }
        >
          <Icon />
          <span>{entry.title}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="min-w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{entry.title}</DropdownMenuLabel>
            {entry.url && (
              <>
                <DropdownMenuItem
                  render={<Link href={entry.url} />}
                  className={
                    isPathActive(pathname, entry.url)
                      ? 'bg-accent text-accent-foreground font-medium'
                      : ''
                  }
                >
                  <span>Все</span>
                </DropdownMenuItem>
                {entry.items.length > 0 && <DropdownMenuSeparator />}
              </>
            )}
            {entry.items.map((child, idx) => {
              if (isSubGroup(child)) {
                return (
                  <Fragment key={`sg-${child.title}`}>
                    {idx > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-muted-foreground text-xs uppercase">
                      {child.title}
                    </DropdownMenuLabel>
                    {child.url && (
                      <DropdownMenuItem
                        render={<Link href={child.url} />}
                        className={
                          isPathActive(pathname, child.url)
                            ? 'bg-accent text-accent-foreground font-medium'
                            : ''
                        }
                      >
                        <span>Все</span>
                      </DropdownMenuItem>
                    )}
                    {child.items.map((sub) => (
                      <DropdownMenuItem
                        key={sub.url}
                        render={<Link href={sub.url} />}
                        className={
                          isPathActive(pathname, sub.url)
                            ? 'bg-accent text-accent-foreground font-medium'
                            : ''
                        }
                      >
                        <span>{sub.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </Fragment>
                )
              }
              return (
                <DropdownMenuItem
                  key={child.url}
                  render={<Link href={child.url} />}
                  className={
                    isPathActive(pathname, child.url)
                      ? 'bg-accent text-accent-foreground font-medium'
                      : ''
                  }
                >
                  <span>{child.title}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────

function NavListSkeleton() {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {Array.from({ length: 5 }).map((_, i) => (
          <SidebarMenuItem key={i}>
            <SidebarMenuButton>
              <Skeleton className="size-4 shrink-0 rounded-sm" />
              <Skeleton className="h-3 flex-1" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
