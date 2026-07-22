'use client'

import { Student } from '@/prisma/generated/client'
import { CustomCombobox } from '@/src/components/custom-combobox'
import { Button } from '@/src/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/src/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/src/components/ui/item'
import { Switch } from '@/src/components/ui/switch'
import { useAddStudentToGroupMutation } from '@/src/features/groups/queries'
import type { GroupWithRelations } from '@/src/features/groups/types'
import { studentKeys } from '@/src/features/students/queries'
import { createWallet as createWalletAction } from '@/src/features/wallets/actions'
import { walletKeys } from '@/src/features/wallets/queries'
import type { WalletWithGroups } from '@/src/features/wallets/types'
import { getWalletLabel } from '@/src/features/wallets/utils'
import { cn, getGroupName } from '@/src/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { Loader, Plus, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

interface AddGroupToStudentButtonProps {
  student: Student
  groups: GroupWithRelations[]
  wallets?: WalletWithGroups[]
}

interface FormValues {
  target: { value: number; label: string } | undefined
  isApplyToLesson: boolean
  walletId: number | undefined
}

export default function AddGroupToStudentButton({
  student,
  groups,
  wallets,
}: AddGroupToStudentButtonProps) {
  const queryClient = useQueryClient()
  const addMutation = useAddStudentToGroupMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isCreatingNewWallet, setIsCreatingNewWallet] = useState(false)
  const [newWalletName, setNewWalletName] = useState('')

  const form = useForm<FormValues>({
    defaultValues: {
      target: undefined,
      isApplyToLesson: true,
      walletId: wallets?.length === 1 ? wallets[0]!.id : undefined,
    },
  })

  useEffect(() => {
    if (wallets?.length === 1) {
      form.setValue('walletId', wallets[0]!.id)
    }
  }, [wallets, form])

  const items = useMemo(() => {
    return groups.map((g) => ({
      label: `${getGroupName(g)}`,
      teachers: `${g.teachers.map((t) => t.teacher.name).join(', ')}`,
      location: g.location.name,
      students: g.students.length,
      maxStudents: g.maxStudents,
      value: g.id,
      disabled: g.students.length >= g.maxStudents,
    }))
  }, [groups])

  const handleSubmit = async (data: FormValues) => {
    if (!data.target) return
    const groupId = data.target.value
    if (!isCreatingNewWallet && wallets && wallets.length > 0 && !data.walletId) {
      form.setError('walletId', { message: 'Выберите кошелёк' })
      return
    }

    let walletId = data.walletId
    let newWalletNameToUse = isCreatingNewWallet ? newWalletName || undefined : undefined

    if (isCreatingNewWallet) {
      const { data: newWallet, serverError } = await createWalletAction({
        studentId: student.id,
        name: newWalletNameToUse,
      })
      if (serverError || !newWallet) return
      walletId = newWallet.id
      newWalletNameToUse = undefined
    }

    addMutation.mutate(
      {
        groupId,
        studentId: student.id,
        walletId,
        isApplyToLesson: data.isApplyToLesson,
      },
      {
        onSuccess: () => {
          setDialogOpen(false)
          queryClient.invalidateQueries({ queryKey: studentKeys.detail(student.id) })
          queryClient.invalidateQueries({ queryKey: studentKeys.all })
          if (isCreatingNewWallet) {
            queryClient.invalidateQueries({ queryKey: walletKeys.byStudent(student.id) })
          }
        },
      },
    )
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (open) {
      form.reset({
        target: undefined,
        isApplyToLesson: true,
        walletId: wallets?.length === 1 ? wallets[0]!.id : undefined,
      })
      setIsCreatingNewWallet(false)
      setNewWalletName('')
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger render={<Button size={'icon'} variant={'outline'} />}>
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить в группу</DialogTitle>
        </DialogHeader>

        <form id="add-group-form" onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup className="gap-2">
            <Controller
              name="target"
              control={form.control}
              rules={{ required: 'Выберите группу' }}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="form-rhf-select-target">Группа</FieldLabel>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  <Combobox
                    items={items}
                    value={field.value ?? null}
                    onValueChange={field.onChange}
                    isItemEqualToValue={(a: { value: number }, b: { value: number }) =>
                      a.value === b.value
                    }
                  >
                    <ComboboxInput id="form-rhf-select-target" aria-invalid={fieldState.invalid} />
                    <ComboboxContent>
                      <ComboboxEmpty>Нет доступных групп</ComboboxEmpty>
                      <ComboboxList>
                        {(item) => (
                          <ComboboxItem key={item.value} value={item} disabled={item.disabled}>
                            <Item size="xs" className="p-0">
                              <ItemContent>
                                <ItemTitle className="whitespace-nowrap">{item.label}</ItemTitle>
                                <ItemDescription>
                                  {item.teachers} | {item.location} |{' '}
                                  <span
                                    className={cn(
                                      'tabular-nums',
                                      item.disabled && 'text-destructive',
                                    )}
                                  >
                                    {item.students}/{item.maxStudents}
                                  </span>
                                </ItemDescription>
                              </ItemContent>
                            </Item>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </Field>
              )}
            />

            <Controller
              name="walletId"
              control={form.control}
              render={({ field, fieldState }) => {
                const hasWallets = wallets && wallets.length > 0
                const isWalletListReady = wallets !== undefined
                return (
                  <Field>
                    <FieldContent>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor="form-rhf-select-wallet">Кошелёк</FieldLabel>
                        {isWalletListReady && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              const next = !isCreatingNewWallet
                              setIsCreatingNewWallet(next)
                              if (next) {
                                field.onChange(undefined)
                              } else if (wallets?.length === 1) {
                                field.onChange(wallets[0]!.id)
                              }
                            }}
                          >
                            {isCreatingNewWallet ? (
                              hasWallets ? (
                                'Выбрать существующий'
                              ) : (
                                'Отмена'
                              )
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                <Wallet />
                                Создать новый
                              </span>
                            )}
                          </Button>
                        )}
                      </div>
                      {fieldState.invalid && !isCreatingNewWallet && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </FieldContent>

                    {isCreatingNewWallet ? (
                      <Input
                        id="new-wallet-name"
                        placeholder="Название нового кошелька (необязательно)"
                        value={newWalletName}
                        onChange={(e) => setNewWalletName(e.target.value)}
                      />
                    ) : (
                      <CustomCombobox
                        items={
                          wallets?.map((w) => ({
                            label: getWalletLabel(w),
                            value: w.id.toString(),
                          })) ?? []
                        }
                        value={
                          field.value
                            ? {
                                label: (() => {
                                  const w = wallets?.find(
                                    (w) => w.id.toString() === field.value?.toString(),
                                  )
                                  return w ? getWalletLabel(w) : ''
                                })(),
                                value: field.value.toString(),
                              }
                            : null
                        }
                        onValueChange={(item) =>
                          field.onChange(item ? Number(item.value) : undefined)
                        }
                        disabled={!hasWallets}
                        id="form-rhf-select-wallet"
                        placeholder={hasWallets ? 'Выберите кошелёк' : 'Нет кошельков'}
                      />
                    )}
                  </Field>
                )
              }}
            />

            <Controller
              name="isApplyToLesson"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="toggle-apply-to-lessons">
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>Применить к урокам</FieldTitle>
                          <FieldDescription>
                            Добавит студента во все будущие уроки, привязанные к этой группе
                          </FieldDescription>
                        </FieldContent>
                        <Switch
                          id="toggle-apply-to-lessons"
                          name={field.name}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </Field>
                    </FieldLabel>
                  </Field>
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setDialogOpen(false)}>
            Отмена
          </Button>
          <Button disabled={addMutation.isPending} type="submit" form="add-group-form">
            {addMutation.isPending && <Loader className="animate-spin" />}
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
