'use client'

import { StudentFinancialField, StudentLessonsBalanceChangeReason } from '@/prisma/generated/enums'
import { CustomCombobox } from '@/src/components/custom-combobox'
import { Hint } from '@/src/components/hint'
import { NumberInput } from '@/src/components/number-input'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/src/components/ui/collapsible'
import { Field, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/src/components/ui/sheet'
import { redistributeBalance } from '@/src/features/students/actions'
import {
  computeGroupStats,
  type StudentGroupWithStats,
} from '@/src/features/students/components/detail/student-groups-section'
import { studentKeys } from '@/src/features/students/queries'
import type { StudentDetail } from '@/src/features/students/types'
import {
  archiveWallet,
  createWallet,
  linkGroupToWallet,
  mergeWallets,
  renameWallet,
  transferWalletBalance,
  updateWalletBalance,
} from '@/src/features/wallets/actions'
import { walletKeys } from '@/src/features/wallets/queries'
import { WalletCard } from '@/src/features/wallets/components/wallet-card'
import { getWalletLabel } from '@/src/features/wallets/utils'
import { cn, getGroupName } from '@/src/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArrowDown,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  Link2,
  Loader,
  Merge,
  Pen,
  Plus,
  RefreshCw,
  TrendingDown,
  TriangleAlert,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type SheetType = 'create' | 'merge' | 'transfer' | 'link' | 'edit' | 'reassign' | null

interface WalletsSectionProps {
  student: StudentDetail
}

export default function WalletsSection({ student }: WalletsSectionProps) {
  const [isPending, startTransition] = useTransition()
  const [activeSheet, setActiveSheet] = useState<SheetType>(null)
  const queryClient = useQueryClient()

  const invalidateStudent = () => {
    queryClient.invalidateQueries({ queryKey: studentKeys.detail(student.id) })
    queryClient.invalidateQueries({ queryKey: walletKeys.byStudent(student.id) })
  }

  // Create wallet state
  const [newWalletName, setNewWalletName] = useState('')

  // Merge state
  const [mergeSource, setMergeSource] = useState<string>('')
  const [mergeTarget, setMergeTarget] = useState<string>('')

  // Transfer state
  const [transferSource, setTransferSource] = useState<string>('')
  const [transferTarget, setTransferTarget] = useState<string>('')
  const [transferLessons, setTransferLessons] = useState(0)
  const [transferTotalLessons, setTransferTotalLessons] = useState(0)
  const [transferTotalPayments, setTransferTotalPayments] = useState(0)

  // Link state
  const [linkWalletId, setLinkWalletId] = useState<string>('')
  const [linkGroupId, setLinkGroupId] = useState<string>('')

  // Edit wallet state
  const [editWalletId, setEditWalletId] = useState<number | null>(null)
  const [editWalletName, setEditWalletName] = useState('')
  const [editLessonsBalance, setEditLessonsBalance] = useState(0)
  const [editTotalPayments, setEditTotalPayments] = useState(0)
  const [editTotalLessons, setEditTotalLessons] = useState(0)

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
    setEditLessonsBalance(w.lessonsBalance)
    setEditTotalPayments(w.totalPayments)
    setEditTotalLessons(w.totalLessons)
    setActiveSheet('edit')
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

  const handleMerge = () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return
    startTransition(async () => {
      try {
        await mergeWallets({
          sourceWalletId: Number(mergeSource),
          targetWalletId: Number(mergeTarget),
        })
        invalidateStudent()
        toast.success('Кошельки объединены')
        setActiveSheet(null)
        setMergeSource('')
        setMergeTarget('')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Не удалось объединить кошельки')
      }
    })
  }

  const handleTransfer = () => {
    if (!transferSource || !transferTarget || transferSource === transferTarget) return
    startTransition(async () => {
      try {
        await transferWalletBalance({
          sourceWalletId: Number(transferSource),
          targetWalletId: Number(transferTarget),
          lessonsBalance: transferLessons,
          totalLessons: transferTotalLessons,
          totalPayments: transferTotalPayments,
        })
        invalidateStudent()
        toast.success('Баланс переведён')
        setActiveSheet(null)
        setTransferSource('')
        setTransferTarget('')
        setTransferLessons(0)
        setTransferTotalLessons(0)
        setTransferTotalPayments(0)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Не удалось перевести баланс')
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

    const nameChanged = (editWalletName || '') !== (original.name || '')

    const changes: Record<string, number> = {}
    if (editLessonsBalance !== original.lessonsBalance) changes.lessonsBalance = editLessonsBalance
    if (editTotalPayments !== original.totalPayments) changes.totalPayments = editTotalPayments
    if (editTotalLessons !== original.totalLessons) changes.totalLessons = editTotalLessons

    if (Object.keys(changes).length === 0 && !nameChanged) {
      setActiveSheet(null)
      return
    }

    const audit: Partial<
      Record<
        StudentFinancialField,
        { reason: StudentLessonsBalanceChangeReason; meta: Record<string, string | number> }
      >
    > = {}
    if ('lessonsBalance' in changes) {
      audit[StudentFinancialField.LESSONS_BALANCE] = {
        reason: StudentLessonsBalanceChangeReason.MANUAL_SET,
        meta: { source: 'wallet-card', walletId: editWalletId },
      }
    }
    if ('totalPayments' in changes) {
      audit[StudentFinancialField.TOTAL_PAYMENTS] = {
        reason: StudentLessonsBalanceChangeReason.MANUAL_SET,
        meta: { source: 'wallet-card', walletId: editWalletId },
      }
    }
    if ('totalLessons' in changes) {
      audit[StudentFinancialField.TOTAL_LESSONS] = {
        reason: StudentLessonsBalanceChangeReason.MANUAL_SET,
        meta: { source: 'wallet-card', walletId: editWalletId },
      }
    }

    startTransition(async () => {
      try {
        const promises: Promise<unknown>[] = []
        if (Object.keys(changes).length > 0) {
          promises.push(
            updateWalletBalance({
              walletId: editWalletId,
              data: changes,
              audit,
            }),
          )
        }
        if (nameChanged) {
          promises.push(
            renameWallet({
              walletId: editWalletId,
              name: editWalletName || undefined,
            }),
          )
        }
        await Promise.all(promises)
        invalidateStudent()
        toast.success('Кошелёк обновлён')
        setActiveSheet(null)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Не удалось обновить кошелёк')
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
          {activeWallets.length >= 2 && (
            <>
              <Button size={'icon'} variant="outline" onClick={() => setActiveSheet('merge')}>
                <Merge />
              </Button>
              <Button size={'icon'} variant="outline" onClick={() => setActiveSheet('transfer')}>
                <ArrowLeftRight />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Unallocated balance warning */}
      {student.lessonsBalance > 0 && (
        <div className="bg-muted/50 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
          <TrendingDown className="text-muted-foreground size-3.5 shrink-0" />
          <span className="text-muted-foreground">
            Нераспределённый остаток:{' '}
            <span className="text-foreground font-medium">{student.lessonsBalance} ур.</span>
            {' - '}не привязан ни к одному кошельку
          </span>
          <Hint
            text="Этот баланс остался от старой системы учёта и не привязан ни к одному кошельку. Используйте «Распределение баланса» чтобы перенести его."
            variant="warning"
          />
        </div>
      )}

      {/* Inline redistribute (collapsible) */}
      <RedistributeInline student={student} />

      {/* Wallet cards */}
      {student.wallets.length === 0 ? (
        <div className="bg-muted/50 rounded-lg border border-dashed p-4 text-center text-sm">
          <p className="text-muted-foreground">Нет кошельков</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {student.wallets.map((w) => {
            // Archived wallets are read-only: minimal card, no actions
            if (w.status === 'ARCHIVED') {
              return <WalletCard key={w.id} wallet={w} />
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
                        sg.status === 'COMPLETED'
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

          {activeSheet === 'merge' && (
            <>
              <SheetHeader>
                <SheetTitle>Объединить кошельки</SheetTitle>
                <SheetDescription>
                  Балансы будут суммированы, группы перенесены в целевой кошелёк, исходный удалён.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <Field>
                  <FieldLabel>Исходный кошелёк (будет удалён)</FieldLabel>
                  <CustomCombobox
                    items={activeWallets.map((w) => ({
                      label: getWalletLabel(w),
                      value: w.id.toString(),
                    }))}
                    value={
                      mergeSource
                        ? { label: walletLabelById(mergeSource), value: mergeSource }
                        : null
                    }
                    onValueChange={(item) => setMergeSource(item?.value ?? '')}
                    placeholder="Выберите"
                  />
                </Field>
                <Field>
                  <FieldLabel>Целевой кошелёк</FieldLabel>
                  <CustomCombobox
                    items={activeWallets
                      .filter((w) => w.id.toString() !== mergeSource)
                      .map((w) => ({ label: getWalletLabel(w), value: w.id.toString() }))}
                    value={
                      mergeTarget
                        ? {
                            label: (() => {
                              const w = student.wallets.find((w) => w.id.toString() === mergeTarget)
                              return w ? getWalletLabel(w) : ''
                            })(),
                            value: mergeTarget,
                          }
                        : null
                    }
                    onValueChange={(item) => setMergeTarget(item?.value ?? '')}
                    placeholder="Выберите"
                  />
                </Field>
              </div>
              <SheetFooter>
                <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
                <Button
                  onClick={handleMerge}
                  disabled={
                    isPending || !mergeSource || !mergeTarget || mergeSource === mergeTarget
                  }
                >
                  {isPending && <Loader className="animate-spin" />}
                  Объединить
                </Button>
              </SheetFooter>
            </>
          )}

          {activeSheet === 'transfer' && (
            <TransferSheet
              student={student}
              transferSource={transferSource}
              setTransferSource={setTransferSource}
              transferTarget={transferTarget}
              setTransferTarget={setTransferTarget}
              transferLessons={transferLessons}
              setTransferLessons={setTransferLessons}
              transferTotalLessons={transferTotalLessons}
              setTransferTotalLessons={setTransferTotalLessons}
              transferTotalPayments={transferTotalPayments}
              setTransferTotalPayments={setTransferTotalPayments}
              isPending={isPending}
              onTransfer={handleTransfer}
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
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="edit-lb">Баланс уроков</FieldLabel>
                    <NumberInput
                      id="edit-lb"
                      value={editLessonsBalance}
                      onChange={(v) => setEditLessonsBalance(v === '' ? 0 : v)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-tp">Сумма оплат</FieldLabel>
                    <NumberInput
                      id="edit-tp"
                      value={editTotalPayments}
                      onChange={(v) => setEditTotalPayments(v === '' ? 0 : v)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-tl">Всего уроков</FieldLabel>
                    <NumberInput
                      id="edit-tl"
                      value={editTotalLessons}
                      onChange={(v) => setEditTotalLessons(v === '' ? 0 : v)}
                    />
                  </Field>
                </FieldGroup>
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

// ─── Wallet Attendance Stats ────────────────────────────────────────

function WalletAttendanceStats({ stats }: { stats: StudentGroupWithStats[] }) {
  return (
    <div className="space-y-1.5">
      <div className="bg-muted/30 h-px" />
      <p className="text-muted-foreground text-[0.625rem] font-medium">Посещаемость:</p>
      {stats.map((gs) => {
        const rate =
          gs.stats.totalLessons > 0
            ? Math.round(
                ((gs.stats.present + gs.stats.madeUp) /
                  (gs.stats.totalLessons - gs.stats.unspecified)) *
                  100,
              )
            : 0
        return (
          <div key={gs.groupId} className="flex items-center justify-between gap-2">
            <span className="truncate text-[0.625rem]">{getGroupName(gs.group)}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="flex items-center gap-0.5" title="Посещено">
                <CheckCircle2 size={10} className="text-green-500" />
                <span>{gs.stats.present}</span>
              </span>
              <span className="flex items-center gap-0.5" title="Отработано">
                <RefreshCw size={10} className="text-blue-500" />
                <span>{gs.stats.madeUp}</span>
              </span>
              <span className="flex items-center gap-0.5" title="Пропущено">
                <XCircle size={10} className="text-red-500" />
                <span>{gs.stats.absent}</span>
              </span>
              <Badge
                variant={rate >= 80 ? 'default' : 'destructive'}
                className="px-1 py-0 text-[0.5rem]"
              >
                {rate}%
              </Badge>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Transfer Sheet ─────────────────────────────────────────────────

function TransferSheet({
  student,
  transferSource,
  setTransferSource,
  transferTarget,
  setTransferTarget,
  transferLessons,
  setTransferLessons,
  transferTotalLessons,
  setTransferTotalLessons,
  transferTotalPayments,
  setTransferTotalPayments,
  isPending,
  onTransfer,
}: {
  student: StudentDetail
  transferSource: string
  setTransferSource: (v: string) => void
  transferTarget: string
  setTransferTarget: (v: string) => void
  transferLessons: number
  setTransferLessons: (v: number) => void
  transferTotalLessons: number
  setTransferTotalLessons: (v: number) => void
  transferTotalPayments: number
  setTransferTotalPayments: (v: number) => void
  isPending: boolean
  onTransfer: () => void
}) {
  const sourceWallet = student.wallets.find((w) => w.id.toString() === transferSource)
  const targetWallet = student.wallets.find((w) => w.id.toString() === transferTarget)

  const bothSelected = !!sourceWallet && !!targetWallet

  // Compute attendance stats for groups linked to each wallet
  const allGroupStats = useMemo(() => computeGroupStats(student), [student])

  const walletGroupStats = useMemo(() => {
    const result = new Map<number, StudentGroupWithStats[]>()
    for (const w of student.wallets) {
      const walletGroupIds = new Set(w.studentGroups.map((sg) => sg.groupId))
      result.set(
        w.id,
        allGroupStats.filter((gs) => walletGroupIds.has(gs.groupId)),
      )
    }
    return result
  }, [student.wallets, allGroupStats])

  const sourceStats = sourceWallet ? (walletGroupStats.get(sourceWallet.id) ?? []) : []
  const targetStats = targetWallet ? (walletGroupStats.get(targetWallet.id) ?? []) : []

  const hasOverflow = sourceWallet
    ? transferLessons > sourceWallet.lessonsBalance ||
      transferTotalLessons > sourceWallet.totalLessons ||
      transferTotalPayments > sourceWallet.totalPayments
    : false

  const transferFields = [
    {
      label: 'Баланс уроков',
      unit: 'ур.',
      value: transferLessons,
      setValue: setTransferLessons,
      sourceKey: 'lessonsBalance' as const,
      targetKey: 'lessonsBalance' as const,
    },
    {
      label: 'Всего уроков',
      unit: 'ур.',
      value: transferTotalLessons,
      setValue: setTransferTotalLessons,
      sourceKey: 'totalLessons' as const,
      targetKey: 'totalLessons' as const,
    },
    {
      label: 'Сумма оплат',
      unit: '₽',
      value: transferTotalPayments,
      setValue: setTransferTotalPayments,
      sourceKey: 'totalPayments' as const,
      targetKey: 'totalPayments' as const,
      formatValue: (v: number) => v.toLocaleString('ru-RU'),
    },
  ]

  return (
    <>
      <SheetHeader>
        <SheetTitle>Перевести баланс</SheetTitle>
        <SheetDescription>Переведите часть баланса из одного кошелька в другой.</SheetDescription>
      </SheetHeader>
      <div className="h-full space-y-4 overflow-y-auto px-4">
        {/* Wallet selectors */}
        <div className="space-y-2">
          <Field>
            <FieldLabel>Из кошелька</FieldLabel>
            <CustomCombobox
              items={student.wallets
                .filter((w) => w.status === 'ACTIVE')
                .map((w) => ({
                  label: getWalletLabel(w),
                  value: w.id.toString(),
                }))}
              value={
                transferSource
                  ? {
                      label: (() => {
                        const w = student.wallets.find((w) => w.id.toString() === transferSource)
                        return w ? getWalletLabel(w) : ''
                      })(),
                      value: transferSource,
                    }
                  : null
              }
              onValueChange={(item) => setTransferSource(item?.value ?? '')}
              placeholder="Выберите"
            />
          </Field>

          {/* Source wallet summary */}
          {sourceWallet && (
            <div className="bg-muted/50 space-y-2 rounded-md px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Баланс:</span>
                <span className="font-medium">{sourceWallet.lessonsBalance} ур.</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Всего уроков:</span>
                <span className="font-medium">{sourceWallet.totalLessons}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Оплаты:</span>
                <span className="font-medium">
                  {sourceWallet.totalPayments.toLocaleString('ru-RU')} ₽
                </span>
              </div>
              {sourceStats.length > 0 && <WalletAttendanceStats stats={sourceStats} />}
            </div>
          )}

          <div className="flex justify-center">
            <ArrowDown className="text-muted-foreground size-4" />
          </div>

          <Field>
            <FieldLabel>В кошелёк</FieldLabel>
            <CustomCombobox
              items={student.wallets
                .filter((w) => w.status === 'ACTIVE' && w.id.toString() !== transferSource)
                .map((w) => ({ label: getWalletLabel(w), value: w.id.toString() }))}
              value={
                transferTarget
                  ? {
                      label: (() => {
                        const w = student.wallets.find((w) => w.id.toString() === transferTarget)
                        return w ? getWalletLabel(w) : ''
                      })(),
                      value: transferTarget,
                    }
                  : null
              }
              onValueChange={(item) => setTransferTarget(item?.value ?? '')}
              placeholder="Выберите"
            />
          </Field>

          {/* Target wallet summary */}
          {targetWallet && targetStats.length > 0 && (
            <div className="bg-muted/50 space-y-2 rounded-md px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Баланс:</span>
                <span className="font-medium">{targetWallet.lessonsBalance} ур.</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Всего уроков:</span>
                <span className="font-medium">{targetWallet.totalLessons}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Оплаты:</span>
                <span className="font-medium">
                  {targetWallet.totalPayments.toLocaleString('ru-RU')} ₽
                </span>
              </div>
              {targetStats.length > 0 && <WalletAttendanceStats stats={targetStats} />}
            </div>
          )}
        </div>

        {/* Transfer fields with max buttons */}
        {bothSelected && (
          <div className="space-y-3">
            <div className="bg-muted/30 h-px" />

            {transferFields.map((f) => {
              const available = sourceWallet[f.sourceKey]
              const format = f.formatValue ?? ((v: number) => v.toString())
              const isOver = f.value > available

              return (
                <Field key={f.sourceKey}>
                  <div className="flex items-center justify-between">
                    <FieldLabel>{f.label}</FieldLabel>
                    <span className="text-muted-foreground text-[0.6875rem]">
                      доступно: {format(available)} {f.unit}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <NumberInput
                      min={0}
                      max={available}
                      value={f.value}
                      onChange={(v) => f.setValue(v === '' ? 0 : Math.max(0, v))}
                      className={cn(isOver && 'border-destructive')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 text-xs"
                      onClick={() => f.setValue(available)}
                      disabled={available === 0}
                    >
                      Всё
                    </Button>
                  </div>
                  {isOver && <p className="text-destructive text-xs">Превышает доступный баланс</p>}
                </Field>
              )
            })}

            {/* Result preview */}
            {(transferLessons > 0 || transferTotalLessons > 0 || transferTotalPayments > 0) &&
              !hasOverflow && (
                <div className="space-y-2">
                  <div className="bg-muted/30 h-px" />
                  <p className="text-muted-foreground text-xs font-medium">После перевода:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/50 space-y-1 rounded-md px-3 py-2 text-xs">
                      <p className="text-muted-foreground truncate font-medium">
                        {getWalletLabel(sourceWallet)}
                      </p>
                      {transferFields.map((f) => (
                        <div key={f.sourceKey} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {f.unit === '₽' ? '₽' : f.label.split(' ')[0]}
                          </span>
                          <span className={cn('font-medium', f.value > 0 && 'text-destructive')}>
                            {(f.formatValue ?? ((v: number) => v.toString()))(
                              sourceWallet[f.sourceKey] - f.value,
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-muted/50 space-y-1 rounded-md px-3 py-2 text-xs">
                      <p className="text-muted-foreground truncate font-medium">
                        {getWalletLabel(targetWallet)}
                      </p>
                      {transferFields.map((f) => (
                        <div key={f.targetKey} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {f.unit === '₽' ? '₽' : f.label.split(' ')[0]}
                          </span>
                          <span className={cn('font-medium', f.value > 0 && 'text-chart-2')}>
                            {(f.formatValue ?? ((v: number) => v.toString()))(
                              targetWallet[f.targetKey] + f.value,
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
      <SheetFooter>
        <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
        <Button
          onClick={onTransfer}
          disabled={
            isPending ||
            !transferSource ||
            !transferTarget ||
            transferSource === transferTarget ||
            hasOverflow ||
            (transferLessons === 0 && transferTotalLessons === 0 && transferTotalPayments === 0)
          }
        >
          {isPending && <Loader className="animate-spin" />}
          Перевести
        </Button>
      </SheetFooter>
    </>
  )
}

// ─── Inline Redistribute ────────────────────────────────────────────

type WalletAllocation = {
  lessons: number
  totalLessons: number
  totalPayments: number
}

function RedistributeInline({ student }: { student: StudentDetail }) {
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()

  // Archived wallets are read-only and cannot receive redistributed balance
  const activeWallets = student.wallets.filter((w) => w.status === 'ACTIVE')

  const unallocatedLessons = student.lessonsBalance
  const unallocatedTotalLessons = student.totalLessons
  const unallocatedTotalPayments = student.totalPayments

  const hasAnythingToRedistribute =
    unallocatedLessons > 0 || unallocatedTotalLessons > 0 || unallocatedTotalPayments > 0

  const [allocations, setAllocations] = useState<Record<number, WalletAllocation>>(() => {
    const initial: Record<number, WalletAllocation> = {}
    for (const w of activeWallets) {
      initial[w.id] = { lessons: 0, totalLessons: 0, totalPayments: 0 }
    }
    return initial
  })

  const sumLessons = Object.values(allocations).reduce((s, a) => s + a.lessons, 0)
  const sumTotalLessons = Object.values(allocations).reduce((s, a) => s + a.totalLessons, 0)
  const sumTotalPayments = Object.values(allocations).reduce((s, a) => s + a.totalPayments, 0)

  const remainingLessons = unallocatedLessons - sumLessons
  const remainingTotalLessons = unallocatedTotalLessons - sumTotalLessons
  const remainingTotalPayments = unallocatedTotalPayments - sumTotalPayments

  const hasOverflow =
    remainingLessons < 0 || remainingTotalLessons < 0 || remainingTotalPayments < 0
  const hasChanges = sumLessons > 0 || sumTotalLessons > 0 || sumTotalPayments > 0

  const updateField = (walletId: number, field: keyof WalletAllocation, value: number) => {
    setAllocations((prev) => ({
      ...prev,
      [walletId]: {
        ...(prev[walletId] ?? { lessons: 0, totalLessons: 0, totalPayments: 0 }),
        [field]: Math.max(0, value),
      },
    }))
  }

  const handleSubmit = () => {
    if (hasOverflow) {
      toast.error('Сумма распределений превышает нераспределённый баланс')
      return
    }

    const entries = Object.entries(allocations)
      .filter(([, a]) => a.lessons > 0 || a.totalLessons > 0 || a.totalPayments > 0)
      .map(([walletId, a]) => ({
        walletId: Number(walletId),
        lessons: a.lessons || undefined,
        totalLessons: a.totalLessons || undefined,
        totalPayments: a.totalPayments || undefined,
      }))

    if (entries.length === 0) {
      toast.error('Укажите хотя бы один кошелёк для распределения')
      return
    }

    startTransition(async () => {
      try {
        await redistributeBalance({
          studentId: student.id,
          allocations: entries,
        })
        queryClient.invalidateQueries({ queryKey: studentKeys.detail(student.id) })
        queryClient.invalidateQueries({ queryKey: walletKeys.byStudent(student.id) })
        toast.success('Баланс успешно перераспределён!')
        setAllocations((prev) => {
          const reset: Record<number, WalletAllocation> = {}
          for (const k of Object.keys(prev)) {
            reset[Number(k)] = { lessons: 0, totalLessons: 0, totalPayments: 0 }
          }
          return reset
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Ошибка при перераспределении баланса')
      }
    })
  }

  if (!hasAnythingToRedistribute || activeWallets.length === 0) {
    return null
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 text-xs transition-colors">
        <TrendingDown className="size-3.5" />
        <span>Распределить нераспределённый баланс</span>
        <ChevronDown className="size-3.5 transition-transform in-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 space-y-3">
          {/* Unallocated summary */}
          <div className="space-y-1 text-xs">
            {unallocatedLessons > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Нераспр. баланс уроков</span>
                <span className="font-medium">{unallocatedLessons} ур.</span>
              </div>
            )}
            {unallocatedTotalLessons > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Нераспр. всего уроков</span>
                <span className="font-medium">{unallocatedTotalLessons}</span>
              </div>
            )}
            {unallocatedTotalPayments > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Нераспр. сумма оплат</span>
                <span className="font-medium">{unallocatedTotalPayments} ₽</span>
              </div>
            )}
          </div>

          {/* Per-wallet inputs */}
          <div className="space-y-3">
            {activeWallets.map((w) => {
              const alloc = allocations[w.id]
              return (
                <div key={w.id} className="space-y-1.5">
                  <Label className="text-xs font-medium">{getWalletLabel(w)}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {unallocatedLessons > 0 && (
                      <Field>
                        <FieldLabel className="text-[0.625rem]">Баланс ур.</FieldLabel>
                        <NumberInput
                          min={0}
                          value={alloc?.lessons ?? 0}
                          onChange={(v) => updateField(w.id, 'lessons', v === '' ? 0 : v)}
                          disabled={isPending}
                        />
                        <span className="text-muted-foreground text-[0.625rem]">
                          сейчас: {w.lessonsBalance}
                        </span>
                      </Field>
                    )}
                    {unallocatedTotalLessons > 0 && (
                      <Field>
                        <FieldLabel className="text-[0.625rem]">Всего ур.</FieldLabel>
                        <NumberInput
                          min={0}
                          value={alloc?.totalLessons ?? 0}
                          onChange={(v) => updateField(w.id, 'totalLessons', v === '' ? 0 : v)}
                          disabled={isPending}
                        />
                        <span className="text-muted-foreground text-[0.625rem]">
                          сейчас: {w.totalLessons}
                        </span>
                      </Field>
                    )}
                    {unallocatedTotalPayments > 0 && (
                      <Field>
                        <FieldLabel className="text-[0.625rem]">Оплаты ₽</FieldLabel>
                        <NumberInput
                          min={0}
                          value={alloc?.totalPayments ?? 0}
                          onChange={(v) => updateField(w.id, 'totalPayments', v === '' ? 0 : v)}
                          disabled={isPending}
                        />
                        <span className="text-muted-foreground text-[0.625rem]">
                          сейчас: {w.totalPayments}
                        </span>
                      </Field>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Remaining summary */}
          <div className="space-y-1 text-xs">
            {unallocatedLessons > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Останется баланс ур.:</span>
                <span
                  className={remainingLessons < 0 ? 'text-destructive font-medium' : 'font-medium'}
                >
                  {remainingLessons}
                </span>
              </div>
            )}
            {unallocatedTotalLessons > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Останется всего ур.:</span>
                <span
                  className={
                    remainingTotalLessons < 0 ? 'text-destructive font-medium' : 'font-medium'
                  }
                >
                  {remainingTotalLessons}
                </span>
              </div>
            )}
            {unallocatedTotalPayments > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Останется оплат ₽:</span>
                <span
                  className={
                    remainingTotalPayments < 0 ? 'text-destructive font-medium' : 'font-medium'
                  }
                >
                  {remainingTotalPayments}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isPending || hasOverflow || !hasChanges}>
              {isPending && <Loader className="mr-2 animate-spin" />}
              Распределить
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
