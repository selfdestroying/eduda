'use client'

import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/src/components/ui/sidebar'
import { cn } from '@/src/lib/utils'
import { Briefcase, Crown, GraduationCap, type LucideIcon } from 'lucide-react'
import { useState, useTransition } from 'react'
import { switchDemoRole } from '../actions'
import { DEMO_ROLE_LABELS, DEMO_ROLES, isDemoRole, type DemoRole } from '../constants'

const ROLE_ICONS: Record<DemoRole, LucideIcon> = {
  owner: Crown,
  manager: Briefcase,
  teacher: GraduationCap,
}

/**
 * Переключатель роли демо в подвале сайдбара. Показывается только внутри
 * демо-организации (гейт в `app-sidebar`). В свёрнутом режиме сворачивается в
 * иконки с тултипами — как остальные пункты сайдбара. Выход отдельной кнопкой
 * не дублируем: он есть в меню пользователя (`NavUser`).
 */
export function DemoBanner({ currentRole }: { currentRole: string | null }) {
  const active: DemoRole = isDemoRole(currentRole) ? currentRole : 'owner'
  const [pending, startTransition] = useTransition()
  const [busyRole, setBusyRole] = useState<DemoRole | null>(null)

  const handleSwitch = (role: DemoRole) => {
    if (role === active || pending) return
    setBusyRole(role)
    startTransition(async () => {
      const res = await switchDemoRole({ role })
      // Полная перезагрузка — сессия/права меняются на серверной стороне.
      if (res?.data?.url) window.location.href = res.data.url
      else window.location.reload()
    })
  }

  return (
    <>
      <SidebarGroupLabel>Демо-режим</SidebarGroupLabel>
      <SidebarMenu>
        {DEMO_ROLES.map((role) => {
          const Icon = ROLE_ICONS[role]
          return (
            <SidebarMenuItem key={role}>
              <SidebarMenuButton
                isActive={role === active}
                tooltip={DEMO_ROLE_LABELS[role]}
                disabled={pending}
                onClick={() => handleSwitch(role)}
                className={cn(busyRole === role && pending && 'animate-pulse')}
              >
                <Icon />
                <span>{DEMO_ROLE_LABELS[role]}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </>
  )
}
