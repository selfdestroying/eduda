'use client'

import { CustomCombobox } from '@repo/ui/components/custom-combobox'
import { Hint } from '@repo/ui/components/hint'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@repo/ui/components/alert-dialog'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@repo/ui/components/field'
import { Input } from '@repo/ui/components/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/sheet'
import { studentKeys } from '@/src/features/students/queries'
import type { StudentDetail } from '@/src/features/students/types'
import {
  archiveWallet,
  createWallet,
  linkGroupToWallet,
  renameWallet,
} from '@/src/features/wallets/actions'
import { walletKeys } from '@/src/features/wallets/queries'
import { WalletCard } from '@/src/features/wallets/components/wallet-card'
import { TransferPackagesSheet } from '@/src/features/wallets/components/transfer-packages-sheet'
import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
import { getWalletLabel } from '@/src/features/wallets/utils'
import { cn, getGroupName } from '@/src/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArrowLeftRight,
  Link2,
  Loader,
  Pen,
  Plus,
  Send,
  TrendingDown,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

// Права проверяются по ссылке на объект, поэтому он живёт в module scope.
const CAN_MOVE_MONEY = { wallet: ['update'] } as const

type SheetType = 'create' | 'transfer' | 'link' | 'edit' | 'reassign' | null

interface WalletsSectionProps {
  student: StudentDetail
}

export default function WalletsSection({ student }: WalletsSectionProps) {
  const [isPending, startTransition] = useTransition()
  const [activeSheet, setActiveSheet] = useState<SheetType>(null)
  const queryClient = useQueryClient()
  const canMoveMoney = useHasPermission(CAN_MOVE_MONEY)

  const invalidateStudent = () => {
    queryClient.invalidateQueries({ queryKey: studentKeys.detail(student.id) })
    queryClient.invalidateQueries({ queryKey: walletKeys.byStudent(student.id) })
  }

  // Create wallet state
  const [newWalletName, setNewWalletName] = useState('')

  // Transfer state
  const [transferFromWalletId, setTransferFromWalletId] = useState<number | null>(null)

  // Link state
  const [linkWalletId, setLinkWalletId] = useState<string>('')
  const [linkGroupId, setLinkGroupId] = useState<string>('')

  // Edit wallet state
  const [editWalletId, setEditWalletId] = useState<number | null>(null)
  const [editWalletName, setEditWalletName] = useState('')

  // Archive confirmation state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiveWalletId, setArchiveWalletId] = useState<number | null>(null)

  // Reassign state
  const [reassignGroupId, setReassignGroupId] = useState<number | null>(null)
  const [reassignFromWalletId, setReassignFromWalletId] = useState<number | null>(null)
  const [reassignToWalletId, setReassignToWalletId] = useState<string>('')

  const unlinkedGroups = student.groups.filter(
    (sg) =>
      (sg.status === 'ACTIVE' || sg.status === 'TRIAL' || sg.status === 'COMPLETED') &&
      !student.wallets.some((w) => w.studentGroups.some((wsg) => wsg.groupId === sg.groupId)),
  )

  // Archived wallets are read-only and excluded from all selectors/operations
  const activeWallets = student.wallets.filter((w) => w.status === 'ACTIVE')

  const walletLabelById = (id: string) =>
    getWalletLabel(student.wallets.find((w) => w.id.toString() === id)!)

  const openEditSheet = (w: StudentDetail['wallets'][number]) => {
    setEditWalletId(w.id)
    setEditWalletName(w.name ?? '')
    setActiveSheet('edit')
  }

  const openTransferSheet = (walletId: number) => {
    setTransferFromWalletId(walletId)
    setActiveSheet('transfer')
  }

  const openLinkSheetForWallet = (walletId: number) => {
    setLinkWalletId(walletId.toString())
    setLinkGroupId('')
    setActiveSheet('link')
  }

  const handleCreate = () => {
    startTransition(async () => {
      try {
        await createWallet({
          studentId: student.id,
          name: newWalletName || undefined,
        })
        invalidateStudent()
        toast.success('Кошелёк создан')
        setActiveSheet(null)
        setNewWalletName('')
      } catch {
        toast.error('Не удалось создать кошелёк')
      }
    })
  }

  const handleLink = () => {
    if (!linkWalletId || !linkGroupId) return
    startTransition(async () => {
      try {
        await linkGroupToWallet({
          studentId: student.id,
          groupId: Number(linkGroupId),
          walletId: Number(linkWalletId),
        })
        invalidateStudent()
        toast.success('Группа привязана к кошельку')
        setActiveSheet(null)
        setLinkWalletId('')
        setLinkGroupId('')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Не удалось привязать группу')
      }
    })
  }

  const handleEditBalance = () => {
    if (editWalletId === null) return
    const original = student.wallets.find((w) => w.id === editWalletId)
    if (!original) return

    if ((editWalletName || '') === (original.name || '')) {
      setActiveSheet(null)
      return
    }

    startTransition(async () => {
      try {
        await renameWallet({ walletId: editWalletId, name: editWalletName || undefined })
        invalidateStudent()
        toast.success('Кошелёк переименован')
        setActiveSheet(null)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Не удалось переименовать кошелёк')
      }
    })
  }

  const confirmArchive = (walletId: number) => {
    setArchiveWalletId(walletId)
    setArchiveDialogOpen(true)
  }

  const openReassignSheet = (groupId: number, currentWalletId: number) => {
    setReassignGroupId(groupId)
    setReassignFromWalletId(currentWalletId)
    setReassignToWalletId('')
    setActiveSheet('reassign')
  }

  const handleReassign = () => {
    if (reassignGroupId === null || !reassignToWalletId) return
    startTransition(async () => {
      try {
        await linkGroupToWallet({
          studentId: student.id,
          groupId: reassignGroupId,
          walletId: Number(reassignToWalletId),
        })
        invalidateStudent()
        toast.success('Группа перепривязана к другому кошельку')
        setActiveSheet(null)
        setReassignGroupId(null)
        setReassignFromWalletId(null)
        setReassignToWalletId('')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Не удалось перепривязать группу')
      }
    })
  }

  const handleArchive = () => {
    if (archiveWalletId === null) return
    startTransition(async () => {
      try {
        await archiveWallet({ walletId: archiveWalletId })
        invalidateStudent()
        toast.success('Кошелёк архивирован')
        setArchiveDialogOpen(false)
        setArchiveWalletId(null)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Не удалось архивировать кошелёк')
      }
    })
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
          <Wallet size={20} />
          Кошельки
          <Hint text="Кошельки хранят баланс уроков и привязаны к группам. Один кошелёк может обслуживать несколько групп. Оплаты зачисляются на конкретный кошелёк." />
        </h3>
        <div className="flex gap-1">
          <Button size={'icon'} variant="outline" onClick={() => setActiveSheet('create')}>
            <Plus />
          </Button>
        </div>
      </div>

      {/* Unallocated balance warning */}
      {student.lessonsBalance > 0 && (
        <div className="bg-muted/50 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
          <TrendingDown className="text-muted-foreground size-3.5 shrink-0" />
          <span className="text-muted-foreground">
            Остаток от старой системы:{' '}
            <span className="text-foreground font-medium">{student.lessonsBalance} ур.</span>
            {' - '}не входит в баланс
          </span>
          <Hint
            text="Уроки, оставшиеся от старой системы учёта. Они не привязаны ни к одному кошельку, ни к одной оплате и в балансе не учитываются. Если ученик реально их не отходил, заведите на них оплату — тогда они станут обычным пакетом."
            variant="warning"
          />
        </div>
      )}

      {/* Wallet cards */}
      {student.wallets.length === 0 ? (
        <div className="bg-muted/50 rounded-lg border border-dashed p-4 text-center text-sm">
          <p className="text-muted-foreground">Нет кошельков</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {student.wallets.map((w) => {
            // Archived wallets are read-only: minimal card, no actions.
            // Исключение — перенос, и только когда на кошельке остались уроки: вернуть
            // его из архива нельзя, так что иначе остаток заперт навсегда.
            if (w.status === 'ARCHIVED') {
              return (
                <WalletCard
                  key={w.id}
                  wallet={w}
                  actions={
                    canMoveMoney && w.lessonsBalance > 0 && activeWallets.length > 0 ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        onClick={() => openTransferSheet(w.id)}
                        disabled={isPending}
                        title="Перенести пакеты на активный кошелёк"
                      >
                        <Send className="size-3" />
                      </Button>
                    ) : undefined
                  }
                />
              )
            }

            return (
              <WalletCard
                key={w.id}
                wallet={w}
                actions={
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      onClick={() => openEditSheet(w)}
                      disabled={isPending}
                    >
                      <Pen className="size-3" />
                    </Button>
                    {unlinkedGroups.length > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        onClick={() => openLinkSheetForWallet(w.id)}
                        disabled={isPending}
                        title="Привязать группу"
                      >
                        <Link2 className="size-3" />
                      </Button>
                    )}
                    {canMoveMoney && activeWallets.length >= 2 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        onClick={() => openTransferSheet(w.id)}
                        disabled={isPending}
                        title="Перенести пакеты на другой кошелёк"
                      >
                        <Send className="size-3" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      onClick={() => confirmArchive(w.id)}
                      disabled={isPending}
                      title="Архивировать кошелёк"
                    >
                      <Archive className="size-3" />
                    </Button>
                  </>
                }
              >
                {/* Linked groups */}
                {w.studentGroups.length > 0 && (
                  <div className="text-muted-foreground space-y-0.5 text-[0.625rem]">
                    <span>Группы:</span>
                    {w.studentGroups.map((sg) => {
                      const isInactive =
                        sg.status === 'DISMISSED' ||
                        sg.status === 'TRANSFERRED' ||
                        sg.status === 'COMPLETED' ||
                        sg.status === 'ARCHIVED'
                      return (
                        <div
                          key={sg.groupId}
                          className={cn(
                            'flex items-center justify-between gap-1',
                            isInactive && 'opacity-50',
                          )}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <span className="truncate">{getGroupName(sg.group)}</span>
                            {sg.status === 'DISMISSED' && (
                              <Badge variant="destructive" className="px-1 py-0 text-[0.5rem]">
                                Отчислен
                              </Badge>
                            )}
                            {sg.status === 'TRANSFERRED' && (
                              <Badge variant="outline" className="px-1 py-0 text-[0.5rem]">
                                Переведён
                              </Badge>
                            )}
                            {sg.status === 'COMPLETED' && (
                              <Badge variant="outline" className="px-1 py-0 text-[0.5rem]">
                                Завершён
                              </Badge>
                            )}
                            {sg.status === 'ARCHIVED' && (
                              <Badge variant="secondary" className="px-1 py-0 text-[0.5rem]">
                                Группа закрыта
                              </Badge>
                            )}
                          </div>
                          {!isInactive && activeWallets.length >= 2 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-5 shrink-0"
                              onClick={() => openReassignSheet(sg.groupId, w.id)}
                              disabled={isPending}
                              title="Перепривязать к другому кошельку"
                            >
                              <ArrowLeftRight className="size-2.5" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </WalletCard>
            )
          })}
        </div>
      )}

      {/* Archive confirmation dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <TriangleAlert />
            </AlertDialogMedia>
            <AlertDialogTitle>Архивировать кошелёк?</AlertDialogTitle>
            <AlertDialogDescription>
              Архивный кошелёк доступен только для просмотра: его нельзя будет редактировать,
              переименовывать, привязывать к группам или использовать в переводах. Вернуть из архива
              нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(() => {
            const target = student.wallets.find((w) => w.id === archiveWalletId)
            const hasActiveGroups = target?.studentGroups.some(
              (sg) => sg.status === 'ACTIVE' || sg.status === 'TRIAL',
            )
            return hasActiveGroups ? (
              <p className="text-destructive px-4 text-sm">
                К кошельку привязаны активные группы — оплаты по ним больше нельзя будет зачислять
                на этот кошелёк.
              </p>
            ) : null
          })()}
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleArchive} disabled={isPending}>
              {isPending && <Loader className="animate-spin" />}
              Архивировать
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single dynamic Sheet */}
      <Sheet open={activeSheet !== null} onOpenChange={(o) => !o && setActiveSheet(null)}>
        <SheetContent side="right">
          {activeSheet === 'create' && (
            <>
              <SheetHeader>
                <SheetTitle>Создать кошелёк</SheetTitle>
                <SheetDescription>Создайте новый кошелёк для ученика.</SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="wallet-name">Название (опционально)</FieldLabel>
                    <Input
                      id="wallet-name"
                      value={newWalletName}
                      onChange={(e) => setNewWalletName(e.target.value)}
                      placeholder="Например: Основной"
                    />
                  </Field>
                </FieldGroup>
              </div>
              <SheetFooter>
                <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
                <Button onClick={handleCreate} disabled={isPending}>
                  {isPending && <Loader className="animate-spin" />}
                  Создать
                </Button>
              </SheetFooter>
            </>
          )}

          {activeSheet === 'transfer' && transferFromWalletId !== null && (
            <TransferPackagesSheet
              student={student}
              fromWalletId={transferFromWalletId}
              onDone={() => {
                setActiveSheet(null)
                setTransferFromWalletId(null)
              }}
            />
          )}

          {activeSheet === 'link' && (
            <>
              <SheetHeader>
                <SheetTitle>Привязать группу к кошельку</SheetTitle>
                <SheetDescription>
                  Выберите группу без кошелька и привяжите её к существующему кошельку.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <Field>
                  <FieldLabel>Кошелёк</FieldLabel>
                  {linkWalletId ? (
                    <Input disabled value={walletLabelById(linkWalletId)} />
                  ) : (
                    <CustomCombobox
                      items={activeWallets.map((w) => ({
                        label: getWalletLabel(w),
                        value: w.id.toString(),
                      }))}
                      value={
                        linkWalletId
                          ? { label: walletLabelById(linkWalletId), value: linkWalletId }
                          : null
                      }
                      onValueChange={(item) => setLinkWalletId(item?.value ?? '')}
                      placeholder="Выберите кошелёк"
                    />
                  )}
                </Field>
                <Field>
                  <FieldLabel>Группа</FieldLabel>
                  <CustomCombobox
                    items={unlinkedGroups.map((sg) => ({
                      label: getGroupName(sg.group),
                      value: sg.groupId.toString(),
                    }))}
                    value={
                      linkGroupId
                        ? {
                            label: (() => {
                              const sg = unlinkedGroups.find(
                                (sg) => sg.groupId.toString() === linkGroupId,
                              )
                              return sg ? getGroupName(sg.group) : ''
                            })(),
                            value: linkGroupId,
                          }
                        : null
                    }
                    onValueChange={(item) => setLinkGroupId(item?.value ?? '')}
                    placeholder="Выберите группу"
                  />
                </Field>
              </div>
              <SheetFooter>
                <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
                <Button onClick={handleLink} disabled={isPending || !linkWalletId || !linkGroupId}>
                  {isPending && <Loader className="animate-spin" />}
                  Привязать
                </Button>
              </SheetFooter>
            </>
          )}

          {activeSheet === 'edit' && editWalletId !== null && (
            <>
              <SheetHeader>
                <SheetTitle>Редактировать кошелёк</SheetTitle>
                <SheetDescription>{walletLabelById(editWalletId.toString())}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <Field>
                  <FieldLabel htmlFor="edit-name">Название</FieldLabel>
                  <Input
                    id="edit-name"
                    value={editWalletName}
                    onChange={(e) => setEditWalletName(e.target.value)}
                    placeholder="Например: Основной"
                  />
                </Field>
                <FieldDescription>
                  Баланс и суммы здесь не правятся: они складываются из оплат и посещений. Нужно
                  добавить уроки — заведите оплату; попала не в тот кошелёк — перенесите пакет
                  кнопкой со стрелкой в шапке карточки.
                </FieldDescription>
              </div>
              <SheetFooter>
                <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
                <Button onClick={handleEditBalance} disabled={isPending}>
                  {isPending && <Loader className="animate-spin" />}
                  Сохранить
                </Button>
              </SheetFooter>
            </>
          )}

          {activeSheet === 'reassign' &&
            reassignGroupId !== null &&
            reassignFromWalletId !== null && (
              <>
                <SheetHeader>
                  <SheetTitle>Перепривязать группу</SheetTitle>
                  <SheetDescription>
                    Выберите кошелёк, к которому будет привязана группа.
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 px-4">
                  <Field>
                    <FieldLabel>Группа</FieldLabel>
                    <Input
                      disabled
                      value={(() => {
                        const w = student.wallets.find((w) => w.id === reassignFromWalletId)
                        const sg = w?.studentGroups.find((sg) => sg.groupId === reassignGroupId)
                        return sg ? getGroupName(sg.group) : ''
                      })()}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Текущий кошелёк</FieldLabel>
                    <Input disabled value={walletLabelById(reassignFromWalletId.toString())} />
                  </Field>
                  <Field>
                    <FieldLabel>Новый кошелёк</FieldLabel>
                    <CustomCombobox
                      items={activeWallets
                        .filter((w) => w.id !== reassignFromWalletId)
                        .map((w) => ({ label: getWalletLabel(w), value: w.id.toString() }))}
                      value={
                        reassignToWalletId
                          ? {
                              label: (() => {
                                const w = student.wallets.find(
                                  (w) => w.id.toString() === reassignToWalletId,
                                )
                                return w ? getWalletLabel(w) : ''
                              })(),
                              value: reassignToWalletId,
                            }
                          : null
                      }
                      onValueChange={(item) => setReassignToWalletId(item?.value ?? '')}
                      placeholder="Выберите кошелёк"
                    />
                  </Field>
                </div>
                <SheetFooter>
                  <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
                  <Button onClick={handleReassign} disabled={isPending || !reassignToWalletId}>
                    {isPending && <Loader className="animate-spin" />}
                    Перепривязать
                  </Button>
                </SheetFooter>
              </>
            )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
