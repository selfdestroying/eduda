'use client'

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
import { Switch } from '@/src/components/ui/switch'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { useStudentListQuery } from '@/src/features/students/queries'
import { useStudentWalletsQuery } from '@/src/features/wallets/queries'
import { getWalletLabel } from '@/src/features/wallets/utils'
import { getFullName } from '@/src/lib/utils'
import { Plus, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useAddStudentToGroupMutation } from '../../queries'

interface AddStudentToGroupButtonProps {
  groupId: number
  excludeStudentIds?: number[]
  isFull?: boolean
}

export default function AddStudentToGroupButton({
  groupId,
  excludeStudentIds,
  isFull,
}: AddStudentToGroupButtonProps) {
  const { data: hasPermission } = useOrganizationPermissionQuery({ studentGroup: ['create'] })
  const { data: allStudents } = useStudentListQuery()
  const addMutation = useAddStudentToGroupMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isCreatingNewWallet, setIsCreatingNewWallet] = useState(false)
  const [newWalletName, setNewWalletName] = useState('')

  const form = useForm<{
    target: { label: string; value: number } | undefined
    isApplyToLesson: boolean
    walletId: number | undefined
  }>({
    defaultValues: {
      target: undefined,
      isApplyToLesson: true,
      walletId: undefined,
    },
  })

  const selectedTarget = form.watch('target')
  const selectedStudentId = selectedTarget?.value
  const { data: walletsData } = useStudentWalletsQuery(selectedStudentId ?? -1, {
    enabled: !!selectedStudentId,
  })
  // Archived wallets cannot receive new group links
  const wallets = useMemo(() => walletsData?.filter((w) => w.status === 'ACTIVE'), [walletsData])

  useEffect(() => {
    if (wallets?.length === 1) {
      form.setValue('walletId', wallets[0]!.id)
    }
  }, [wallets, form])

  const excludeSet = useMemo(() => new Set(excludeStudentIds ?? []), [excludeStudentIds])
  const students = useMemo(
    () => allStudents?.filter((s) => !excludeSet.has(s.id)) ?? [],
    [allStudents, excludeSet],
  )

  const items = useMemo(() => {
    return students.map((s) => ({
      label: getFullName(s.firstName, s.lastName),
      value: s.id,
    }))
  }, [students])

  const handleSubmit = (data: {
    target: { label: string; value: number } | undefined
    isApplyToLesson: boolean
    walletId: number | undefined
  }) => {
    if (!data.target) return

    if (!isCreatingNewWallet && wallets && wallets.length > 0 && !data.walletId) {
      form.setError('walletId', { message: 'Выберите кошелёк' })
      return
    }

    addMutation.mutate(
      {
        groupId,
        studentId: data.target.value,
        walletId: isCreatingNewWallet ? undefined : data.walletId,
        isApplyToLesson: data.isApplyToLesson,
        newWalletName: isCreatingNewWallet ? newWalletName || undefined : undefined,
      },
      {
        onSuccess: () => {
          setDialogOpen(false)
        },
      },
    )
  }

  useEffect(() => {
    form.reset({ target: undefined, isApplyToLesson: true, walletId: undefined })
    setIsCreatingNewWallet(false)
    setNewWalletName('')
  }, [dialogOpen, form])

  if (!hasPermission) return null

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger
        render={
          <Button size={'icon'} disabled={isFull} title={isFull ? 'Группа заполнена' : undefined} />
        }
      >
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить студента</DialogTitle>
        </DialogHeader>

        <form id="add-student-form" onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup className="gap-2">
            <Controller
              name="target"
              control={form.control}
              rules={{ required: 'Выберите студента' }}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="form-rhf-select-target">Студент</FieldLabel>
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
                      <ComboboxEmpty>Нет доступных студентов</ComboboxEmpty>
                      <ComboboxList>
                        {(item) => (
                          <ComboboxItem key={item.value} value={item}>
                            {item.label}
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
                        placeholder={
                          !isWalletListReady
                            ? 'Сначала выберите ученика'
                            : hasWallets
                              ? 'Выберите кошелёк'
                              : 'Нет кошельков'
                        }
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
          <Button disabled={addMutation.isPending} type="submit" form="add-student-form">
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
