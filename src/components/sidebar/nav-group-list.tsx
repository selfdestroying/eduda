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
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/src/components/ui/sidebar'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Skeleton } from '../ui/skeleton'
import type { NavGroup } from './lib/types'

interface NavGroupListProps {
  label: string
  groups: NavGroup[]
  isLoading?: boolean
}

function NavGroupListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <Skeleton className="h-4 w-full" />
      </SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuButton>
          <Skeleton className="h-6 w-full" />
        </SidebarMenuButton>
        <SidebarMenuSub>
          {Array.from({ length: count }).map((_, i) => (
            <SidebarMenuSubItem key={i}>
              <SidebarMenuSubButton>
                <Skeleton className="h-6 w-full" />
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </SidebarMenu>
    </SidebarGroup>
  )
}

export default function NavGroupList({ label, groups, isLoading }: NavGroupListProps) {
  const pathname = usePathname()
  const { state, isMobile } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile

  if (isLoading) {
    return <NavGroupListSkeleton count={3} />
  }

  if (groups.length === 0) return null

  return (
    <SidebarGroup>
      {!isCollapsed ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarMenu>
        {groups.map((group) =>
          isCollapsed ? (
            <SidebarMenuItem key={group.title}>
              <DropdownMenu>
                <DropdownMenuTrigger render={<SidebarMenuButton tooltip={group.title} />}>
                  <group.icon />
                  <span>{group.title}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{group.title}</DropdownMenuLabel>
                    {group.items.map((subItem) => (
                      <DropdownMenuItem
                        key={subItem.url}
                        render={<Link href={subItem.url} />}
                        className={
                          pathname === subItem.url
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : ''
                        }
                      >
                        <span>{subItem.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ) : (
            <Collapsible
              key={group.title}
              render={<SidebarMenuItem />}
              defaultOpen
              className="group/collapsible"
            >
              <CollapsibleTrigger render={<SidebarMenuButton tooltip={group.title} />}>
                <group.icon />
                <span>{group.title}</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {group.items.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.url}>
                      <SidebarMenuSubButton
                        isActive={pathname === subItem.url}
                        render={<Link href={subItem.url} />}
                      >
                        <span>{subItem.title}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          ),
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
