'use client'

import { redistributeBalance } from '@/src/actions/students'
import { Button } from '@/src/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { getGroupName } from '@/src/lib/utils'
import { StudentWithGroupsAndAttendance } from '@/src/types/student'
import { ArrowRightLeft, Loader } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

interface RedistributeBalanceProps {
  student: StudentWithGroupsAndAttendance
}

export default function RedistributeBalance({ student }: RedistributeBalanceProps) {
  const [isPending, startTransition] = useTransition()

  const allocatedBalance = student.groups.reduce((sum, sg) => sum + sg.lessonsBalance, 0)
  const unallocatedBalance = student.lessonsBalance

  const [allocations, setAllocations] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {}
    for (const sg of student.groups) {
      initial[sg.groupId] = 0
    }
    return initial
  })

  const totalToAllocate = Object.values(allocations).reduce((sum, v) => sum + v, 0)
  const remaining = unallocatedBalance - totalToAllocate

  const handleSubmit = () => {
    if (remaining < 0) {
      toast.error('Сумма распределений превышает нераспределённый баланс')
      return
    }

    const allocationEntries = Object.entries(allocations)
      .filter(([, amount]) => amount > 0)
      .map(([groupId, amount]) => ({ groupId: Number(groupId), lessons: amount }))

    if (allocationEntries.length === 0) {
      toast.error('Укажите хотя бы одну группу для распределения')
      return
    }

    startTransition(async () => {
      try {
        await redistributeBalance(student.id, allocationEntries)
        toast.success('Баланс успешно перераспределён!')
        setAllocations((prev) => {
          const reset: Record<number, number> = {}
          for (const k of Object.keys(prev)) {
            reset[Number(k)] = 0
          }
          return reset
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Ошибка при перераспределении баланса')
      }
    })
  }

  if (unallocatedBalance <= 0 || student.groups.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <ArrowRightLeft size={20} />
        Распределение баланса
      </h3>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span>Нераспределённый баланс</span>
          <span className="font-semibold">{unallocatedBalance} ур.</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Уже распределено</span>
          <span className="font-medium">{allocatedBalance} ур.</span>
        </div>
      </div>

      <FieldGroup>
        {student.groups.map((sg) => (
          <Field key={sg.groupId}>
            <FieldLabel>{getGroupName(sg.group)}</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={unallocatedBalance}
                value={allocations[sg.groupId] ?? 0}
                onChange={(e) =>
                  setAllocations((prev) => ({
                    ...prev,
                    [sg.groupId]: Math.max(0, Number(e.target.value)),
                  }))
                }
                disabled={isPending}
                className="w-24"
              />
              <Label className="text-muted-foreground text-sm">
                текущий: {sg.lessonsBalance} ур.
              </Label>
            </div>
          </Field>
        ))}
      </FieldGroup>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          {remaining >= 0 ? (
            <span>
              Останется нераспределённых: <strong>{remaining}</strong> ур.
            </span>
          ) : (
            <span className="text-destructive font-medium">
              Превышено на {Math.abs(remaining)} ур.
            </span>
          )}
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isPending || remaining < 0 || totalToAllocate === 0}
        >
          {isPending && <Loader className="mr-2 animate-spin" />}
          Распределить
        </Button>
      </div>
    </div>
  )
}
