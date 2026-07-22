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
import { Field, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/src/components/ui/radio-group'
import { PERMISSION_MODULE_KEYS, type ModuleLevel } from '@/src/lib/permissions/modules'
import { slugify } from '@/src/lib/utils'
import { Loader, Plus } from 'lucide-react'
import { useState } from 'react'
import { useRoleCreateMutation } from '../queries'

const PRESETS: { value: ModuleLevel; label: string; description: string }[] = [
  { value: 'none', label: 'Без доступов', description: 'Ничего не видит — настроите вручную' },
  { value: 'view', label: 'Просмотр', description: 'Только просмотр всех разделов' },
  { value: 'manage', label: 'Управление', description: 'Просмотр и редактирование всех разделов' },
]

const buildModules = (level: ModuleLevel): Record<string, ModuleLevel> =>
  Object.fromEntries(PERMISSION_MODULE_KEYS.map((key) => [key, level]))

export default function AddRoleDialog() {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [slug, setSlug] = useState('')
  // slug следует за названием, пока пользователь не отредактирует его вручную.
  const [slugEdited, setSlugEdited] = useState(false)
  const [preset, setPreset] = useState<ModuleLevel>('none')
  const { mutate, isPending } = useRoleCreateMutation()

  const reset = () => {
    setLabel('')
    setSlug('')
    setSlugEdited(false)
    setPreset('none')
  }

  const onLabelChange = (value: string) => {
    setLabel(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  const onSlugChange = (value: string) => {
    setSlug(value)
    setSlugEdited(value.length > 0)
  }

  const onCreate = () =>
    mutate(
      { role: slug, label, modules: buildModules(preset) },
      { onSuccess: () => setOpen(false) },
    )

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
          <Button size={'icon'}>
            <Plus />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Новая роль</DialogTitle>
          <DialogDescription>Доступы можно настроить после создания.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="new-role-label">Название</FieldLabel>
            <Input
              id="new-role-label"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="Например, Администратор"
              disabled={isPending}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="new-role-slug">Идентификатор</FieldLabel>
            <Input
              id="new-role-slug"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              placeholder="admin"
              className="font-mono"
              disabled={isPending}
            />
          </Field>

          <Field>
            <FieldLabel>Стартовый доступ</FieldLabel>
            <RadioGroup
              value={preset}
              onValueChange={(v) => setPreset(v as ModuleLevel)}
              disabled={isPending}
              className="gap-2"
            >
              {PRESETS.map((p) => (
                <label
                  key={p.value}
                  className="has-data-checked:border-primary flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors"
                >
                  <RadioGroupItem value={p.value} className="mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{p.label}</span>
                    <span className="text-muted-foreground text-xs">{p.description}</span>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </Field>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
          <Button onClick={onCreate} disabled={isPending || !label || !slug}>
            {isPending && <Loader className="animate-spin" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
