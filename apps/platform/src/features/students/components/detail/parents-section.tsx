'use client'

import { CustomCombobox } from '@/src/components/custom-combobox'
import { Hint } from '@/src/components/hint'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog'
import { Button } from '@/src/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/src/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import {
  useLinkParentMutation,
  useParentCreateMutation,
  useParentListQuery,
  useParentUpdateMutation,
  useUnlinkParentMutation,
} from '@/src/features/parents/queries'
import {
  CreateParentSchema,
  CreateParentSchemaType,
  UpdateParentSchema,
  UpdateParentSchemaType,
} from '@/src/features/parents/schemas'
import { ParentWithStudents } from '@/src/features/parents/types'
import { studentKeys } from '@/src/features/students/queries'
import { rootDomain, protocol } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink,
  Loader,
  Mail,
  Pen,
  Phone,
  Plus,
  TriangleAlert,
  Unlink,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

// ─── Types ───────────────────────────────────────────────────────────────

interface ParentData {
  id: number
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
  accessToken: string
}

interface ParentsSectionProps {
  studentId: number
  parents: Array<{ parent: ParentData }>
  canEdit: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function RequiredMark() {
  return <span className="text-destructive">*</span>
}

function OptionalMark() {
  return <span className="text-muted-foreground text-xs font-normal">(необязательно)</span>
}

function getParentFullName(parent: ParentData) {
  return [parent.firstName, parent.lastName].filter(Boolean).join(' ')
}

// ─── WhatsApp & Telegram Badges ──────────────────────────────────────────

function WhatsAppBadge({ phone }: { phone: string }) {
  return (
    <a
      href={`https://wa.me/${phone.replace(/\D/g, '')}`}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-background inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.625rem] font-medium text-emerald-600 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:ring-emerald-800 dark:hover:bg-emerald-950/40"
    >
      <svg viewBox="0 0 24 24" className="size-3 fill-current">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.553 4.126 1.522 5.862L.054 23.65a.5.5 0 0 0 .611.611l5.788-1.468A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 0 1-5.39-1.584l-.386-.232-3.436.871.87-3.436-.232-.386A9.94 9.94 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </svg>
      WhatsApp
    </a>
  )
}

function TelegramBadge({ phone }: { phone: string }) {
  return (
    <a
      href={`https://t.me/${phone.replace(/\D/g, '')}`}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-background inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.625rem] font-medium text-sky-600 ring-1 ring-sky-200 transition-colors hover:bg-sky-50 dark:text-sky-400 dark:ring-sky-800 dark:hover:bg-sky-950/40"
    >
      <svg viewBox="0 0 24 24" className="size-3 fill-current">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
      Telegram
    </a>
  )
}

// ─── Parent Card (display) ───────────────────────────────────────────────

function ParentCard({
  parent,
  canEdit,
  onEdit,
  onUnlink,
}: {
  parent: ParentData
  canEdit: boolean
  onEdit: () => void
  onUnlink: () => void
}) {
  const parentEditUrl = rootDomain
    ? `${protocol}://${rootDomain}/cabinet/${parent.accessToken}`
    : `/cabinet/${parent.accessToken}`
  return (
    <div className="bg-muted/50 flex flex-col gap-2 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{getParentFullName(parent)}</span>
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <Button variant="ghost" size={'icon'} onClick={onEdit}>
              <Pen />
            </Button>
            <Button variant="ghost" size={'icon'} onClick={onUnlink}>
              <Unlink />
            </Button>
          </div>
        )}
      </div>
      {parent.phone ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Phone className="text-muted-foreground size-3" />
            <a href={`tel:${parent.phone}`} className="text-primary text-sm hover:underline">
              {parent.phone}
            </a>
          </div>
          <div className="flex gap-1.5">
            <WhatsAppBadge phone={parent.phone} />
            <TelegramBadge phone={parent.phone} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Phone className="text-muted-foreground size-3" />
            <span className="text-muted-foreground text-sm">Номер не указан</span>
          </div>
        </div>
      )}
      {parent.email ? (
        <div className="flex items-center gap-2">
          <Mail className="text-muted-foreground size-3" />
          <a href={`mailto:${parent.email}`} className="text-primary text-sm hover:underline">
            {parent.email}
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Mail className="text-muted-foreground size-3" />
          <span className="text-muted-foreground text-sm">Email не указан</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <ExternalLink className="text-muted-foreground size-3 shrink-0" />
          <a
            href={parentEditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-sm hover:underline"
          >
            Ссылка на личный кабинет
          </a>
          <Hint
            text="Персональная ссылка на личный кабинет, которую вы можете отправить родителю. По ней он
          может просматривать данные ученика, его финансы и посещаемость."
          />
        </div>
      </div>
    </div>
  )
}

// ─── Edit Parent Sheet ───────────────────────────────────────────────────

function EditParentSheet({
  parent,
  open,
  onOpenChange,
}: {
  parent: ParentData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const updateMutation = useParentUpdateMutation()

  const form = useForm<UpdateParentSchemaType>({
    resolver: zodResolver(UpdateParentSchema),
    values: parent
      ? {
          id: parent.id,
          firstName: parent.firstName,
          lastName: parent.lastName ?? undefined,
          phone: parent.phone ?? undefined,
          email: parent.email ?? undefined,
        }
      : undefined,
  })

  const onSubmit = (values: UpdateParentSchemaType) => {
    updateMutation.mutate(values, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: studentKeys.all })
        onOpenChange(false)
      },
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Редактировать родителя</SheetTitle>
          <SheetDescription>Измените данные родителя.</SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          id="edit-parent-form"
          className="no-scrollbar overflow-auto px-6"
        >
          <FieldGroup>
            <Controller
              control={form.control}
              name="firstName"
              disabled={updateMutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="edit-parent-firstName">
                    Имя <RequiredMark />
                  </FieldLabel>
                  <Input
                    id="edit-parent-firstName"
                    placeholder="Введите имя"
                    {...field}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="lastName"
              disabled={updateMutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="edit-parent-lastName">
                    Фамилия <OptionalMark />
                  </FieldLabel>
                  <Input
                    id="edit-parent-lastName"
                    placeholder="Введите фамилию"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="phone"
              disabled={updateMutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="edit-parent-phone">
                    Телефон <OptionalMark />
                  </FieldLabel>
                  <Input
                    id="edit-parent-phone"
                    type="tel"
                    placeholder="+7 (999) 123-45-67"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="email"
              disabled={updateMutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="edit-parent-email">
                    Email <OptionalMark />
                  </FieldLabel>
                  <Input
                    id="edit-parent-email"
                    type="email"
                    placeholder="parent@example.com"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
          <Button type="submit" form="edit-parent-form" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader className="animate-spin" />}
            Сохранить
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ─── Add Parent Sheet (create new + link, or link existing) ──────────────

function AddParentSheet({
  studentId,
  linkedParentIds,
  open,
  onOpenChange,
}: {
  studentId: number
  linkedParentIds: Set<number>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: allParents = [] } = useParentListQuery()
  const createMutation = useParentCreateMutation()
  const linkMutation = useLinkParentMutation()
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [selectedParent, setSelectedParent] = useState<ParentWithStudents | null>(null)

  const handleModeChange = (value: string) => setMode(value as 'new' | 'existing')

  const availableParents = allParents.filter((p) => !linkedParentIds.has(p.id))

  const form = useForm<CreateParentSchemaType>({
    resolver: zodResolver(CreateParentSchema),
    defaultValues: { firstName: '', lastName: undefined, phone: undefined, email: undefined },
  })

  const handleCreateAndLink = (values: CreateParentSchemaType) => {
    createMutation.mutate(values, {
      onSuccess: (data) => {
        if (data) {
          linkMutation.mutate(
            { studentId, parentId: data.id },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: studentKeys.all })
                form.reset()
                onOpenChange(false)
              },
            },
          )
        }
      },
    })
  }

  const handleLinkExisting = () => {
    if (!selectedParent) return
    linkMutation.mutate(
      { studentId, parentId: selectedParent.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: studentKeys.all })
          setSelectedParent(null)
          onOpenChange(false)
        },
      },
    )
  }

  const isPending = createMutation.isPending || linkMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Добавить родителя</SheetTitle>
          <SheetDescription>Создайте нового или выберите из существующих.</SheetDescription>
        </SheetHeader>
        <div className="no-scrollbar flex flex-col gap-4 overflow-auto px-6">
          <Tabs value={mode} onValueChange={handleModeChange}>
            <TabsList className="w-full">
              <TabsTrigger value="new">Новый</TabsTrigger>
              <TabsTrigger value="existing">Существующий</TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="mt-3">
              <form onSubmit={form.handleSubmit(handleCreateAndLink)} id="add-parent-form">
                <FieldGroup>
                  <Controller
                    control={form.control}
                    name="firstName"
                    disabled={isPending}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel htmlFor="add-parent-firstName">
                          Имя <RequiredMark />
                        </FieldLabel>
                        <Input
                          id="add-parent-firstName"
                          placeholder="Введите имя"
                          {...field}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="lastName"
                    disabled={isPending}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel htmlFor="add-parent-lastName">
                          Фамилия <OptionalMark />
                        </FieldLabel>
                        <Input
                          id="add-parent-lastName"
                          placeholder="Введите фамилию"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="phone"
                    disabled={isPending}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel htmlFor="add-parent-phone">
                          Телефон <OptionalMark />
                        </FieldLabel>
                        <Input
                          id="add-parent-phone"
                          type="tel"
                          placeholder="+7 (999) 123-45-67"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="email"
                    disabled={isPending}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel htmlFor="add-parent-email">
                          Email <OptionalMark />
                        </FieldLabel>
                        <Input
                          id="add-parent-email"
                          type="email"
                          placeholder="parent@example.com"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </form>
            </TabsContent>

            <TabsContent value="existing" className="mt-3">
              <Field>
                <FieldLabel>Выберите родителя</FieldLabel>
                <CustomCombobox<ParentWithStudents>
                  items={availableParents}
                  value={selectedParent}
                  onValueChange={setSelectedParent}
                  getLabel={(p) => getParentFullName(p) + (p.phone ? ` (${p.phone})` : '')}
                  getKey={(p) => p.id}
                  placeholder="Поиск по имени или телефону..."
                  disabled={isPending}
                  showClear
                />
              </Field>
            </TabsContent>
          </Tabs>
        </div>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
          {mode === 'new' ? (
            <Button type="submit" form="add-parent-form" disabled={isPending}>
              {isPending && <Loader className="animate-spin" />}
              Создать и привязать
            </Button>
          ) : (
            <Button onClick={handleLinkExisting} disabled={isPending || !selectedParent}>
              {isPending && <Loader className="animate-spin" />}
              Привязать
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main ParentsSection ─────────────────────────────────────────────────

export default function ParentsSection({ studentId, parents, canEdit }: ParentsSectionProps) {
  const queryClient = useQueryClient()
  const unlinkMutation = useUnlinkParentMutation()

  const [editingParent, setEditingParent] = useState<ParentData | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false)
  const [unlinkTarget, setUnlinkTarget] = useState<ParentData | null>(null)

  const linkedParentIds = new Set(parents.map((sp) => sp.parent.id))

  const handleEdit = (parent: ParentData) => {
    setEditingParent(parent)
    setEditSheetOpen(true)
  }

  const handleUnlinkConfirm = (parent: ParentData) => {
    setUnlinkTarget(parent)
    setUnlinkDialogOpen(true)
  }

  const handleUnlink = () => {
    if (!unlinkTarget) return
    unlinkMutation.mutate(
      { studentId, parentId: unlinkTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: studentKeys.all })
          setUnlinkDialogOpen(false)
          setUnlinkTarget(null)
        },
      },
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
          <Users size={20} />
          Родители
        </h3>
        {canEdit && (
          <Button variant="outline" size={'icon'} onClick={() => setAddSheetOpen(true)}>
            <Plus />
          </Button>
        )}
      </div>

      {parents.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {parents.map(({ parent }) => (
            <ParentCard
              key={parent.id}
              parent={parent}
              canEdit={canEdit}
              onEdit={() => handleEdit(parent)}
              onUnlink={() => handleUnlinkConfirm(parent)}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Родители не указаны</p>
      )}

      {/* Edit Parent Sheet */}
      <EditParentSheet
        parent={editingParent}
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
      />

      {/* Add Parent Sheet */}
      <AddParentSheet
        studentId={studentId}
        linkedParentIds={linkedParentIds}
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
      />

      {/* Unlink Confirmation */}
      <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <TriangleAlert />
            </AlertDialogMedia>
            <AlertDialogTitle>Открепить родителя?</AlertDialogTitle>
            <AlertDialogDescription>
              {unlinkTarget && (
                <>
                  <strong>{getParentFullName(unlinkTarget)}</strong> будет откреплён от ученика. Сам
                  родитель не будет удалён.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setUnlinkDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnlink}
              disabled={unlinkMutation.isPending}
            >
              {unlinkMutation.isPending && <Loader className="animate-spin" />}
              Открепить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
