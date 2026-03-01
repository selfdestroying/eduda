'use client'

import { useSessionQuery } from '@/src/data/user/session-query'
import type { OrganizationRole } from '@/src/lib/auth/server'
import { ShoppingCart } from 'lucide-react'
import { useMemo } from 'react'
import { filterNavByRole } from './lib/filter-nav-by-role'
import type { NavGroup } from './lib/types'
import NavGroupList from './nav-group-list'

const navLists: NavGroup[] = [
  {
    title: 'Магазин',
    icon: ShoppingCart,
    roles: ['owner', 'manager', 'teacher'],
    items: [
      {
        title: 'Товары',
        url: '/dashboard/shop/products',
        roles: ['owner', 'manager', 'teacher'],
      },
      {
        title: 'Категории',
        url: '/dashboard/shop/categories',
        roles: ['owner', 'manager', 'teacher'],
      },
      {
        title: 'Заказы',
        url: '/dashboard/shop/orders',
        roles: ['owner', 'manager', 'teacher'],
      },
    ],
  },
]

export default function NavShop() {
  const { data: session, isLoading } = useSessionQuery()
  const role = session?.memberRole as OrganizationRole | undefined

  const filteredNavList = useMemo(() => (role ? filterNavByRole(navLists, role) : []), [role])

  return <NavGroupList label="Магазин" groups={filteredNavList} isLoading={isLoading} />
}
