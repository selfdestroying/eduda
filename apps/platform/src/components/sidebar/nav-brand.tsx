'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@repo/ui/components/sidebar'
import { Skeleton } from '@repo/ui/components/skeleton'
import { useSessionQuery } from '@/src/features/users/me/queries'
import type { OrganizationRole } from '@/src/lib/auth/server'
import { isFeatureDisabled } from '@/src/lib/features/registry'
import { DEFAULT_TZ, formatTimeZoneLabel } from '@/src/lib/timezone'
import { cn, isKnowledgeDay, isSeptember } from '@/src/lib/utils'
import {
  BellRing,
  BookOpen,
  Briefcase,
  Building2,
  ChevronsUpDown,
  Coins,
  CreditCard,
  type LucideIcon,
  Package,
  Percent,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { AutumnLeaves } from './autumn-leaves'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'

type OrgMenuItem = {
  title: string
  url: string
  icon: LucideIcon
  roles: OrganizationRole[]
  featureKey?: string
  isSubgroup?: boolean
  items?: OrgMenuItem[]
}

const STAFF_ROLES: OrganizationRole[] = ['owner', 'manager']

const ORG_MENU_ITEMS: OrgMenuItem[] = [
  {
    title: 'Курсы',
    url: '/organization/courses',
    icon: BookOpen,
    roles: STAFF_ROLES,
    featureKey: 'organization.courses',
  },
  { title: 'Сотрудники', url: '/organization/members', icon: Users, roles: STAFF_ROLES },
  { title: 'Роли и доступы', url: '/organization/roles', icon: ShieldCheck, roles: ['owner'] },
  {
    title: 'Ставки',
    url: '/organization/rates',
    icon: Coins,
    roles: STAFF_ROLES,
    isSubgroup: true,
    items: [
      {
        title: 'Преподавателей',
        url: '/organization/rates/teacher',
        icon: Coins,
        roles: STAFF_ROLES,
        featureKey: 'organization.rates',
      },
      {
        title: 'Менеджеров',
        url: '/organization/rates/manager',
        icon: Briefcase,
        roles: ['owner'],
        featureKey: 'finances.managerSalaries',
      },
    ],
  },

  {
    title: 'Локации и аренда',
    url: '/organization/locations',
    icon: Building2,
    roles: STAFF_ROLES,
    featureKey: 'organization.locations',
  },
  {
    title: 'Методы оплаты',
    url: '/finances/payment-methods',
    icon: CreditCard,
    roles: ['owner'],
    featureKey: 'finances.paymentMethods',
  },
  {
    title: 'Продукты',
    url: '/finances/products',
    icon: Package,
    roles: ['owner'],
    featureKey: 'finances.products',
  },
  {
    title: 'Напоминания родителям',
    url: '/organization/notifications',
    icon: BellRing,
    roles: STAFF_ROLES,
    featureKey: 'notifications',
  },
  { title: 'Налоги', url: '/organization/tax-systems', icon: Percent, roles: ['owner'] },
  {
    title: 'Прочие расходы',
    url: '/finances/expenses',
    icon: Wallet,
    roles: ['owner'],
  },
]

function NavBrandSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="cursor-default">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/**
 * Sidebar header brand block: organization avatar + name.
 * Non-interactive label (visual identity of the current school/org).
 */
export default function NavBrand() {
  const { data: session, isLoading } = useSessionQuery()

  if (isLoading) return <NavBrandSkeleton />

  const orgName = session?.organization?.name ?? ''
  const tz = session?.organization?.timezone ?? DEFAULT_TZ
  const tzLabel = formatTimeZoneLabel(tz)
  // Весь сентябрь строка школы подсвечена осенним градиентом, а 1 сентября
  // часовой пояс под названием ещё и уступает место поздравлению.
  const september = isSeptember(tz)
  const knowledgeDay = isKnowledgeDay(tz)
  const role = (session?.memberRole ?? undefined) as OrganizationRole | undefined
  const disabledFeatures = (session?.disabledFeatures as string[] | undefined) ?? []
  const orgItems = role
    ? ORG_MENU_ITEMS.filter(
        (item) =>
          item.roles.includes(role) &&
          (!item.featureKey || !isFeatureDisabled(disabledFeatures, item.featureKey)),
      )
    : []

  if (orgItems.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip={orgName}
            className={cn(
              'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground',
              september &&
                'animate-gradient-drift relative isolate bg-linear-to-r from-amber-400/25 to-orange-500/15 bg-size-[200%_100%]',
            )}
          >
            <Avatar>
              <AvatarImage alt={orgName} />
              <AvatarFallback
                className={cn(
                  september &&
                    'animate-gradient-drift bg-linear-to-r from-amber-500 to-orange-600 bg-size-[200%_100%] text-white',
                )}
              >
                {orgName?.[0]}
              </AvatarFallback>
            </Avatar>

            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{orgName}</span>
              <span
                className={cn(
                  'truncate text-xs',
                  knowledgeDay ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
                )}
              >
                {knowledgeDay ? 'С Днём знаний!' : tzLabel}
              </span>
            </div>
            {september && <AutumnLeaves />}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={orgName}
                className={cn(
                  'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground',
                  september &&
                    'animate-gradient-drift relative isolate bg-linear-to-r from-amber-400/25 to-orange-500/15 bg-size-[200%_100%]',
                )}
              />
            }
          >
            <Avatar>
              <AvatarImage alt={orgName} />
              <AvatarFallback
                className={cn(
                  september &&
                    'animate-gradient-drift bg-linear-to-r from-amber-500 to-orange-600 bg-size-[200%_100%] text-white',
                )}
              >
                {orgName?.[0]}
              </AvatarFallback>
            </Avatar>

            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{orgName}</span>
              <span
                className={cn(
                  'truncate text-xs',
                  knowledgeDay ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
                )}
              >
                {knowledgeDay ? 'С Днём знаний!' : tzLabel}
              </span>
            </div>
            {september && <AutumnLeaves />}
            <ChevronsUpDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-56">
            <DropdownMenuGroup>
              {orgItems.map((item) => {
                const Icon = item.icon
                return item.isSubgroup ? (
                  <DropdownMenuSub key={item.url}>
                    <DropdownMenuSubTrigger>
                      <Icon />
                      {item.title}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {item.items?.map((subItem) => {
                        return (
                          <DropdownMenuItem key={subItem.url} render={<Link href={subItem.url} />}>
                            {subItem.title}
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : (
                  <DropdownMenuItem key={item.url} render={<Link href={item.url} />}>
                    <Icon />
                    {item.title}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
