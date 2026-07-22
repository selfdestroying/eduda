'use client'

import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Loader, Pen } from 'lucide-react'
import { useState } from 'react'
import { useRoleInfoUpdateMutation } from '../queries'
import type { RoleDTO } from '../types'

/** Приводит ручной ввод к допустимому виду slug. */
const sanitizeSlug = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')

export default function EditRoleDialog({
  role,
  onRenamed,
}: {
  role: RoleDTO
  onRenamed?: (newRole: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(role.label)
  const [slug, setSlug] = useState(role.role)
  const { mutate, isPending } = useRoleInfoUpdateMutation()

  // Идентификатор системной роли менять нельзя.
  const slugEditable = !role.isSystem

  const reset = () => {
    setLabel(role.label)
    setSlug(role.role)
  }

  const onSave = () => {
    const newRole = slugEditable && slug !== role.role ? slug : undefined
    mutate(
      { role: role.role, label, newRole },
      {
        onSuccess: () => {
          setOpen(false)
          if (newRole) onRenamed?.(newRole)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Редактировать роль">
            <Pen />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Редактировать роль</DialogTitle>
          <DialogDescription>
            {slugEditable ? 'Название и идентификатор роли.' : 'Название роли.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="edit-role-label">Название</FieldLabel>
            <Input
              id="edit-role-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isPending}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="edit-role-slug">Идентификатор</FieldLabel>
            <Input
              id="edit-role-slug"
              value={slug}
              onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
              className="font-mono"
              disabled={!slugEditable || isPending}
            />
            {!slugEditable && (
              <FieldDescription>Идентификатор системной роли изменить нельзя.</FieldDescription>
            )}
          </Field>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
          <Button onClick={onSave} disabled={isPending || !label || !slug}>
            {isPending && <Loader className="animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
