'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/src/components/ui/alert-dialog'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Skeleton } from '@/src/components/ui/skeleton'
import {
  PERMISSION_MODULE_KEYS,
  permissionToModules,
  type ModuleLevel,
  type ModuleSelection,
} from '@/src/lib/permissions/modules'
import { cn } from '@/src/lib/utils'
import { ChevronRight, Loader, Lock, Save, Trash, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useRoleDeleteMutation, useRoleUpdateMutation, useRolesQuery } from '../queries'
import type { RoleDTO } from '../types'
import EditRoleDialog from './edit-role-dialog'
import RoleAccess from './role-access'

function DeleteRoleButton({ role, onDeleted }: { role: RoleDTO; onDeleted: () => void }) {
  const { mutate, isPending } = useRoleDeleteMutation()
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size={'icon'}>
            <Trash />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить роль «{role.label}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Действие необратимо. Роль нельзя удалить, пока она назначена участникам.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() => mutate({ role: role.role }, { onSuccess: onDeleted })}
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RoleCard({
  role,
  selected,
  onSelect,
}: {
  role: RoleDTO
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group bg-card focus-visible:ring-ring/50 flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2',
        selected ? 'border-primary' : 'hover:border-foreground/15 hover:bg-accent/40',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">{role.label}</span>
        <Badge variant="outline" className="font-mono">
          {role.role}
        </Badge>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className="text-muted-foreground inline-flex items-center gap-1.5 text-xs"
          title={`Сотрудников с ролью: ${role.memberCount}`}
        >
          <Users className="size-3.5" />
          {role.memberCount}
        </span>
        <ChevronRight
          className={cn(
            'size-4 transition-colors',
            selected
              ? 'text-primary'
              : 'text-muted-foreground/40 group-hover:text-muted-foreground',
          )}
        />
      </div>
    </button>
  )
}

function Section({
  title,
  roles,
  selected,
  onSelect,
}: {
  title: string
  roles: RoleDTO[]
  selected: string
  onSelect: (role: string) => void
}) {
  if (roles.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        {title}
        <span className="text-muted-foreground/60">{roles.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <RoleCard
            key={role.role}
            role={role}
            selected={selected === role.role}
            onSelect={() => onSelect(role.role)}
          />
        ))}
      </div>
    </section>
  )
}

export default function RolesList() {
  const { data: roles = [], isLoading, isError } = useRolesQuery()
  const { mutate, isPending } = useRoleUpdateMutation()
  // Владелец выбран по умолчанию (эта роль всегда присутствует).
  const [selected, setSelected] = useState<string>('owner')

  const selectedRole = roles.find((r) => r.role === selected)
  const initial = useMemo<ModuleSelection>(
    () => (selectedRole ? permissionToModules(selectedRole.permission) : {}),
    [selectedRole],
  )
  const [selection, setSelection] = useState<ModuleSelection>(initial)
  // Пересинхронизируем при смене роли и после сохранения (сбрасывает правки).
  useEffect(() => setSelection(initial), [initial])

  const isDirty = PERMISSION_MODULE_KEYS.some(
    (key) => (selection[key] ?? 'none') !== (initial[key] ?? 'none'),
  )
  const editable = !!selectedRole && !selectedRole.immutable

  const setLevel = (key: string, level: ModuleLevel) =>
    setSelection((prev) => ({ ...prev, [key]: level }))

  const saveAccess = () => {
    if (!selectedRole) return
    mutate({
      role: selectedRole.role,
      label: selectedRole.label,
      modules: selection as Record<string, ModuleLevel>,
    })
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <div className="text-destructive text-sm">Ошибка при загрузке ролей.</div>
  }

  const systemRoles = roles.filter((r) => r.isSystem)
  const customRoles = roles.filter((r) => !r.isSystem)

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Системные роли"
        roles={systemRoles}
        selected={selected}
        onSelect={setSelected}
      />
      <Section title="Свои роли" roles={customRoles} selected={selected} onSelect={setSelected} />

      {selectedRole && (
        <section className="flex flex-col gap-2 border-t pt-4">
          <div className="flex h-9 flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Доступ роли
            </span>
            <span className="text-sm font-medium">{selectedRole.label}</span>
            {selectedRole.immutable && (
              <Badge variant="secondary">
                <Lock />
              </Badge>
            )}
            {!selectedRole.immutable && (
              <div className="ml-auto flex items-center gap-1">
                <Button size={'icon'} onClick={saveAccess} disabled={!isDirty || isPending}>
                  {isPending ? <Loader className="animate-spin" /> : <Save />}
                </Button>
                {!selectedRole.isSystem && (
                  <>
                    <EditRoleDialog role={selectedRole} onRenamed={(next) => setSelected(next)} />
                    <DeleteRoleButton role={selectedRole} onDeleted={() => setSelected('owner')} />
                  </>
                )}
              </div>
            )}
          </div>
          <RoleAccess selection={selection} onChange={setLevel} disabled={!editable} />
        </section>
      )}
    </div>
  )
}
