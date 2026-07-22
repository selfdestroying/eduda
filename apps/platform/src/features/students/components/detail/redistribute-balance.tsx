'use client'

import { Hint } from '@/src/components/hint'
import { NumberInput } from '@/src/components/number-input'
import { Button } from '@/src/components/ui/button'
import { Field, FieldLabel } from '@/src/components/ui/field'
import { Label } from '@/src/components/ui/label'
import { getGroupName } from '@/src/lib/utils'
import { ArrowRightLeft, Loader } from 'lucide-react'
import { useState } from 'react'
import { useRedistributeBalanceMutation } from '../../queries'
import type { StudentDetail } from '../../types'

interface RedistributeBalanceProps {
  student: StudentDetail
}

type WalletAllocation = {
  lessons: number
  totalLessons: number
  totalPayments: number
}

export default function RedistributeBalance({ student }: RedistributeBalanceProps) {
  const mutation = useRedistributeBalanceMutation(student.id)

  const unallocatedLessons = student.lessonsBalance
  const unallocatedTotalLessons = student.totalLessons
  const unallocatedTotalPayments = student.totalPayments

  const hasAnythingToRedistribute =
    unallocatedLessons > 0 || unallocatedTotalLessons > 0 || unallocatedTotalPayments > 0

  const [allocations, setAllocations] = useState<Record<number, WalletAllocation>>(() => {
    const initial: Record<number, WalletAllocation> = {}
    for (const w of student.wallets) {
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
    if (hasOverflow) return

    const entries = Object.entries(allocations)
      .filter(([, a]) => a.lessons > 0 || a.totalLessons > 0 || a.totalPayments > 0)
      .map(([walletId, a]) => ({
        walletId: Number(walletId),
        lessons: a.lessons || undefined,
        totalLessons: a.totalLessons || undefined,
        totalPayments: a.totalPayments || undefined,
      }))

    if (entries.length === 0) return

    mutation.mutate(
      { studentId: student.id, allocations: entries },
      {
        onSuccess: () => {
          setAllocations((prev) => {
            const reset: Record<number, WalletAllocation> = {}
            for (const k of Object.keys(prev)) {
              reset[Number(k)] = { lessons: 0, totalLessons: 0, totalPayments: 0 }
            }
            return reset
          })
        },
      },
    )
  }

  if (!hasAnythingToRedistribute || student.wallets.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <ArrowRightLeft size={20} />
        Распределение баланса
        <Hint text="Перенос нераспределённого баланса (уроков, оплат) со старого поля ученика на конкретные кошельки. Это одноразовая миграция данных." />
      </h3>

      <div className="space-y-1 text-sm">
        {unallocatedLessons > 0 && (
          <div className="flex items-center justify-between">
            <span>Нераспр. баланс уроков</span>
            <span className="font-semibold">{unallocatedLessons} ур.</span>
          </div>
        )}
        {unallocatedTotalLessons > 0 && (
          <div className="flex items-center justify-between">
            <span>Нераспр. всего уроков</span>
            <span className="font-semibold">{unallocatedTotalLessons}</span>
          </div>
        )}
        {unallocatedTotalPayments > 0 && (
          <div className="flex items-center justify-between">
            <span>Нераспр. сумма оплат</span>
            <span className="font-semibold">{unallocatedTotalPayments} ₽</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {student.wallets.map((w) => {
          const alloc = allocations[w.id]
          const groupNames = w.studentGroups.map((sg) => getGroupName(sg.group)).join(', ')
          const walletLabel = w.name
            ? `${w.name} (${groupNames || 'без групп'})`
            : groupNames || `Кошелёк #${w.id}`
          return (
            <div key={w.id} className="space-y-2">
              <Label className="text-sm font-medium">{walletLabel}</Label>
              <div className="grid grid-cols-3 gap-2">
                {unallocatedLessons > 0 && (
                  <Field>
                    <FieldLabel className="text-xs">Баланс ур.</FieldLabel>
                    <NumberInput
                      min={0}
                      value={alloc?.lessons ?? 0}
                      onChange={(v) => updateField(w.id, 'lessons', v === '' ? 0 : v)}
                      disabled={mutation.isPending}
                    />
                    <span className="text-muted-foreground text-xs">
                      сейчас: {w.lessonsBalance}
                    </span>
                  </Field>
                )}
                {unallocatedTotalLessons > 0 && (
                  <Field>
                    <FieldLabel className="text-xs">Всего ур.</FieldLabel>
                    <NumberInput
                      min={0}
                      value={alloc?.totalLessons ?? 0}
                      onChange={(v) => updateField(w.id, 'totalLessons', v === '' ? 0 : v)}
                      disabled={mutation.isPending}
                    />
                    <span className="text-muted-foreground text-xs">сейчас: {w.totalLessons}</span>
                  </Field>
                )}
                {unallocatedTotalPayments > 0 && (
                  <Field>
                    <FieldLabel className="text-xs">Оплаты ₽</FieldLabel>
                    <NumberInput
                      min={0}
                      value={alloc?.totalPayments ?? 0}
                      onChange={(v) => updateField(w.id, 'totalPayments', v === '' ? 0 : v)}
                      disabled={mutation.isPending}
                    />
                    <span className="text-muted-foreground text-xs">сейчас: {w.totalPayments}</span>
                  </Field>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-1 text-sm">
        {unallocatedLessons > 0 && (
          <div className="flex items-center justify-between">
            <span>Останется баланс ур.:</span>
            <span className={remainingLessons < 0 ? 'text-destructive font-medium' : 'font-medium'}>
              {remainingLessons}
            </span>
          </div>
        )}
        {unallocatedTotalLessons > 0 && (
          <div className="flex items-center justify-between">
            <span>Останется всего ур.:</span>
            <span
              className={remainingTotalLessons < 0 ? 'text-destructive font-medium' : 'font-medium'}
            >
              {remainingTotalLessons}
            </span>
          </div>
        )}
        {unallocatedTotalPayments > 0 && (
          <div className="flex items-center justify-between">
            <span>Останется оплат ₽:</span>
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
        <Button onClick={handleSubmit} disabled={mutation.isPending || hasOverflow || !hasChanges}>
          {mutation.isPending && <Loader className="mr-2 animate-spin" />}
          Распределить
        </Button>
      </div>
    </div>
  )
}
