'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/src/components/ui/sidebar'
import { useSignOutMutation } from '@/src/data/user/sign-out-mutation'
import { ChevronsUpDown, LogOut, User } from 'lucide-react'
import Link from 'next/link'

import { useSessionQuery } from '@/src/data/user/session-query'
import type { OrganizationRole } from '@/src/lib/auth/server'
import { useRouter } from 'next/navigation'
import { Skeleton } from '../ui/skeleton'

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

export default function NavUser() {
  const router = useRouter()
  const { data: session, isLoading } = useSessionQuery()
  const { mutate, isPending: isSignOutPending } = useSignOutMutation()

  if (isLoading) {
    return <NavUserSkeleton />
  }

  const userName = session?.user?.name
  const memberRole = session?.memberRole as OrganizationRole | undefined

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar>
              <AvatarImage alt={userName} />
              <AvatarFallback>{userName?.[0]}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{userName}</span>
              <span className="text-muted-foreground truncate text-xs">
                {memberRole ? memberRoleLabels[memberRole] : '-'}
              </span>
            </div>
            <ChevronsUpDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/me" />}>
                <User />
                Профиль
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                disabled={isSignOutPending}
                onClick={() =>
                  mutate(undefined, {
                    onSuccess: () => {
                      router.push('/')
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
