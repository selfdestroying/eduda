'use client'

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/src/components/ui/sidebar'
import { useSessionQuery } from '@/src/data/user/session-query'
import type { OrganizationRole } from '@/src/lib/auth/server'
import { Building, Folder, LayoutDashboard, Users, Wallet } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { filterNavByRole } from './lib/filter-nav-by-role'
import type { NavGroup } from './lib/types'
import NavGroupList from './nav-group-list'

const navLists: NavGroup[] = [
  {
    title: 'Школа',
    icon: Building,
    roles: ['owner', 'manager'],
    items: [
      {
        title: 'Сотрудники',
        url: '/dashboard/organization/members',
        roles: ['owner', 'manager'],
      },
      {
        title: 'Ставки',
        url: '/dashboard/organization/rates',
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    title: 'Ученики',
    icon: Users,
    roles: ['owner', 'manager', 'teacher'],
    items: [
      {
        title: 'Все',
        url: '/dashboard/students',
        roles: ['owner', 'manager', 'teacher'],
      },
      {
        title: 'Активные',
        url: '/dashboard/students/active',
        roles: ['owner', 'manager'],
      },
      {
        title: 'Пропустившие',
        url: '/dashboard/students/absent',
        roles: ['owner', 'manager'],
      },
      {
        title: 'Отчисленные',
        url: '/dashboard/students/dismissed',
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    title: 'Группы',
    icon: Folder,
    roles: ['owner', 'manager', 'teacher'],
    items: [
      {
        title: 'Группы',
        url: '/dashboard/groups',
        roles: ['owner', 'manager', 'teacher'],
      },
      {
        title: 'Типы',
        url: '/dashboard/groups/types',
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    title: 'Финансы',
    icon: Wallet,
    roles: ['owner', 'manager', 'teacher'],
    items: [
      {
        title: 'Оплаты',
        url: '/dashboard/finances/payments',
        roles: ['owner', 'manager'],
      },
      {
        title: 'Выручка',
        url: '/dashboard/finances/revenue',
        roles: ['owner'],
      },
      {
        title: 'Зарплаты',
        url: '/dashboard/finances/salaries',
        roles: ['owner', 'manager', 'teacher'],
      },
    ],
  },
]

export default function NavPlatform() {
  const { data: session, isLoading } = useSessionQuery()
  const pathname = usePathname()
  const role = session?.memberRole as OrganizationRole | undefined

  const filteredNavList = useMemo(() => (role ? filterNavByRole(navLists, role) : []), [role])

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Платформа</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === '/dashboard'}
              render={<Link href="/dashboard" />}
            >
              <LayoutDashboard />
              <span>Панель управления</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <NavGroupList label="Навигация" groups={filteredNavList} isLoading={isLoading} />
    </>
  )
}
