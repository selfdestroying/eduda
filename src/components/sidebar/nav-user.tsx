'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/src/components/ui/sidebar'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useSessionQuery } from '@/src/features/users/me/queries'
import { useSignOutMutation } from '@/src/features/users/me/queries'
import type { OrganizationRole } from '@/src/lib/auth/server'
import {
  Banknote,
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Receipt,
  Settings,
  Sun,
  User,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useSyncExternalStore } from 'react'

export const memberRoleLabels = {
  owner: 'Владелец',
  manager: 'Менеджер',
  teacher: 'Учитель',
} as const satisfies Record<OrganizationRole, string>

function NavUserSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="cursor-default">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="grid flex-1 gap-1">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/**
 * Subscribe-once helper that returns `true` only after client hydration.
 * Avoids next-themes hydration mismatch when rendering theme indicators.
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

export default function NavUser() {
  const { data: session, isLoading } = useSessionQuery()
  const { mutate, isPending: isSignOutPending } = useSignOutMutation()
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  if (isLoading) return <NavUserSkeleton />

  const userName = session?.user?.name ?? ''
  const memberRole = session?.memberRole as OrganizationRole | undefined
  const initial = userName.slice(0, 1).toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={userName}
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar>
              <AvatarImage alt={userName} />
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{userName}</span>
              <span className="text-muted-foreground truncate text-xs">
                {memberRole ? memberRoleLabels[memberRole] : '-'}
              </span>
            </div>
            <ChevronsUpDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/me" />}>
                <User />
                Профиль
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/me/paychecks" />}>
                <Receipt />
                Мои чеки
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/me/salary" />}>
                <Banknote />
                Моя зарплата
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/me/settings" />}>
                <Settings />
                Настройки
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette />
                  Тема
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={mounted ? (theme ?? 'system') : undefined}
                    onValueChange={setTheme}
                  >
                    <DropdownMenuRadioItem value="light">
                      <Sun />
                      Светлая
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      <Moon />
                      Тёмная
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                      <Monitor />
                      Системная
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                disabled={isSignOutPending}
                onClick={() =>
                  mutate(undefined, {
                    onSuccess: () => {
                      // Полная перезагрузка вместо router.refresh():
                      // после выхода proxy редиректит на auth-поддомен (другой origin),
                      // а RSC-запрос refresh() не может последовать за кросс-origin
                      // редиректом и падает с "Failed to fetch".
                      window.location.reload()
                    },
                  })
                }
              >
                <LogOut />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
