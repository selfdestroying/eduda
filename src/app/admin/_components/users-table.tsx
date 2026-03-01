'use client'

import DataTable from '@/src/components/data-table'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { Input } from '@/src/components/ui/input'
import { authClient } from '@/src/lib/auth/client'
import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Ban, Loader, ShieldCheck, UserX } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import CreateUserDialog from './create-user-dialog'
import EditUserDialog from './edit-user-dialog'
import PasswordChangeDialog from './password-change-dialog'
import type { AdminDashboardData, AdminUser } from './types'

interface UsersTableProps {
  data: AdminDashboardData
  onRefresh: () => void
}

export default function UsersTable({ data, onRefresh }: UsersTableProps) {
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [loadingUserId, setLoadingUserId] = useState<number | null>(null)

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return data.users
    const q = search.toLowerCase()
    return data.users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q),
    )
  }, [data.users, search])

  const getUserOrganizations = (userId: number) => {
    return data.organizations.filter((org) => org.members.some((m) => m.userId === userId))
  }

  const handleBanUser = (userId: number, ban: boolean) => {
    setLoadingUserId(userId)
    startTransition(async () => {
      try {
        if (ban) {
          await authClient.admin.banUser({ userId })
          toast.success('Пользователь заблокирован')
        } else {
          await authClient.admin.unbanUser({ userId })
          toast.success('Пользователь разблокирован')
        }
        onRefresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка')
      } finally {
        setLoadingUserId(null)
      }
    })
  }

  const handleSetRole = (userId: number, role: string) => {
    setLoadingUserId(userId)
    startTransition(async () => {
      try {
        await authClient.admin.setRole({
          userId: userId.toString(),
          role: role as 'user' | 'admin' | 'owner',
        })
        toast.success(`Роль изменена на "${role}"`)
        onRefresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка')
      } finally {
        setLoadingUserId(null)
      }
    })
  }

  const handleRemoveUser = (userId: number) => {
    setLoadingUserId(userId)
    startTransition(async () => {
      try {
        await authClient.admin.removeUser({ userId })
        toast.success('Пользователь удалён')
        onRefresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка')
      } finally {
        setLoadingUserId(null)
      }
    })
  }

  const getRoleBadgeVariant = (role: string | null) => {
    switch (role) {
      case 'admin':
        return 'default'
      case 'owner':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const columns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Имя',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Роль',
      cell: ({ row }) =>
        row.original.role ? (
          <Badge variant={getRoleBadgeVariant(row.original.role)}>{row.original.role}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
    },
    {
      id: 'status',
      header: 'Статус',
      cell: ({ row }) =>
        row.original.banned ? (
          <Badge variant="destructive">Заблокирован</Badge>
        ) : (
          <Badge variant="outline">Активен</Badge>
        ),
    },
    {
      id: 'organizations',
      header: 'Организации',
      cell: ({ row }) => {
        const orgs = getUserOrganizations(row.original.id)
        return (
          <div className="flex flex-wrap gap-1">
            {orgs.length > 0 ? (
              orgs.map((org) => (
                <Badge key={org.id} variant="secondary" className="text-xs">
                  {org.name}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground text-xs">-</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: () => <span className="block text-right">Действия</span>,
      cell: ({ row }) => {
        const user = row.original
        const isLoading = loadingUserId === user.id && isPending
        return (
          <div className="flex items-center justify-end gap-1">
            {/* Редактирование */}
            <EditUserDialog user={user} onSuccess={onRefresh} disabled={isLoading} />

            {/* Смена пароля */}
            <PasswordChangeDialog user={user} disabled={isLoading} />

            {/* Смена роли */}
            <Dialog>
              <DialogTrigger
                render={
                  <Button size="icon" variant="ghost" title="Сменить роль" disabled={isLoading} />
                }
              >
                <ShieldCheck className="size-4" />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Изменить роль</DialogTitle>
                  <DialogDescription>Текущая роль: {user.role || 'user'}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-wrap gap-2">
                  {['user', 'admin', 'owner'].map((role) => (
                    <DialogClose
                      key={role}
                      render={
                        <Button
                          variant={user.role === role ? 'default' : 'outline'}
                          onClick={() => handleSetRole(user.id, role)}
                          disabled={isLoading}
                        />
                      }
                    >
                      {role}
                    </DialogClose>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            {/* Бан / Разбан */}
            <Button
              size="icon"
              variant={user.banned ? 'outline' : 'ghost'}
              title={user.banned ? 'Разблокировать' : 'Заблокировать'}
              onClick={() => handleBanUser(user.id, !user.banned)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader className="size-4 animate-spin" />
              ) : user.banned ? (
                <ShieldCheck className="size-4" />
              ) : (
                <Ban className="size-4" />
              )}
            </Button>

            {/* Удаление */}
            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    title="Удалить пользователя"
                    disabled={isLoading}
                  />
                }
              >
                <UserX className="size-4" />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Удалить пользователя?</DialogTitle>
                  <DialogDescription>
                    Вы уверены что хотите удалить {user.name} ({user.email})? Это действие
                    необратимо.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2">
                  <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
                  <DialogClose
                    render={
                      <Button
                        variant="destructive"
                        onClick={() => handleRemoveUser(user.id)}
                        disabled={isLoading}
                      />
                    }
                  >
                    Удалить
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Пользователи ({data.users.length})</span>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Поиск по имени, email, роли..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <CreateUserDialog onSuccess={onRefresh} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable table={table} emptyMessage="Пользователи не найдены" />
      </CardContent>
    </Card>
  )
}
