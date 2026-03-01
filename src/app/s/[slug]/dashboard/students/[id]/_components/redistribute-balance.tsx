'use client'

import { redistributeBalance } from '@/src/actions/students'
import { Button } from '@/src/components/ui/button'
import { Field, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { getGroupName } from '@/src/lib/utils'
import { ArrowRightLeft, Loader } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { StudentWithGroupsAndAttendance } from './types'

interface RedistributeBalanceProps {
  student: StudentWithGroupsAndAttendance
}

type GroupAllocation = {
  lessons: number
  totalLessons: number
  totalPayments: number
}

export default function RedistributeBalance({ student }: RedistributeBalanceProps) {
  const [isPending, startTransition] = useTransition()

  const unallocatedLessons = student.lessonsBalance
  const unallocatedTotalLessons = student.totalLessons
  const unallocatedTotalPayments = student.totalPayments

  const hasAnythingToRedistribute =
    unallocatedLessons > 0 || unallocatedTotalLessons > 0 || unallocatedTotalPayments > 0

  const [allocations, setAllocations] = useState<Record<number, GroupAllocation>>(() => {
    const initial: Record<number, GroupAllocation> = {}
    for (const sg of student.groups) {
      initial[sg.groupId] = { lessons: 0, totalLessons: 0, totalPayments: 0 }
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

  const updateField = (groupId: number, field: keyof GroupAllocation, value: number) => {
    setAllocations((prev) => ({
      ...prev,
      [groupId]: { ...prev[groupId], [field]: Math.max(0, value) },
    }))
  }

  const handleSubmit = () => {
    if (hasOverflow) {
      toast.error('Сумма распределений превышает нераспределённый баланс')
      return
    }

    const entries = Object.entries(allocations)
      .filter(([, a]) => a.lessons > 0 || a.totalLessons > 0 || a.totalPayments > 0)
      .map(([groupId, a]) => ({
        groupId: Number(groupId),
        lessons: a.lessons || undefined,
        totalLessons: a.totalLessons || undefined,
        totalPayments: a.totalPayments || undefined,
      }))

    if (entries.length === 0) {
      toast.error('Укажите хотя бы одну группу для распределения')
      return
    }

    startTransition(async () => {
      try {
        await redistributeBalance(student.id, entries)
        toast.success('Баланс успешно перераспределён!')
        setAllocations((prev) => {
          const reset: Record<number, GroupAllocation> = {}
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

  if (!hasAnythingToRedistribute || student.groups.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <ArrowRightLeft size={20} />
        Распределение баланса
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
        {student.groups.map((sg) => {
          const alloc = allocations[sg.groupId]
          return (
            <div key={sg.groupId} className="space-y-2">
              <Label className="text-sm font-medium">{getGroupName(sg.group)}</Label>
              <div className="grid grid-cols-3 gap-2">
                {unallocatedLessons > 0 && (
                  <Field>
                    <FieldLabel className="text-xs">Баланс ур.</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={alloc?.lessons ?? 0}
                      onChange={(e) => updateField(sg.groupId, 'lessons', Number(e.target.value))}
                      disabled={isPending}
                    />
                    <span className="text-muted-foreground text-xs">
                      сейчас: {sg.lessonsBalance}
                    </span>
                  </Field>
                )}
                {unallocatedTotalLessons > 0 && (
                  <Field>
                    <FieldLabel className="text-xs">Всего ур.</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={alloc?.totalLessons ?? 0}
                      onChange={(e) =>
                        updateField(sg.groupId, 'totalLessons', Number(e.target.value))
                      }
                      disabled={isPending}
                    />
                    <span className="text-muted-foreground text-xs">сейчас: {sg.totalLessons}</span>
                  </Field>
                )}
                {unallocatedTotalPayments > 0 && (
                  <Field>
                    <FieldLabel className="text-xs">Оплаты ₽</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={alloc?.totalPayments ?? 0}
                      onChange={(e) =>
                        updateField(sg.groupId, 'totalPayments', Number(e.target.value))
                      }
                      disabled={isPending}
                    />
                    <span className="text-muted-foreground text-xs">
                      сейчас: {sg.totalPayments}
                    </span>
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
        <Button onClick={handleSubmit} disabled={isPending || hasOverflow || !hasChanges}>
          {isPending && <Loader className="mr-2 animate-spin" />}
          Распределить
        </Button>
      </div>
    </div>
  )
}
