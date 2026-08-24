'use client'

import type { Attendance } from '@repo/db'
import { AttendanceStatus } from '@repo/db/enums'
import { Separator } from '@repo/ui/components/separator'
import { Toggle } from '@repo/ui/components/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { BellRing, Check, Loader, Minus, X } from 'lucide-react'
import { useUpdateAttendanceStatusMutation } from '../queries'

export type AttendanceForStatusSwitcher = Pick<
  Attendance,
  'studentId' | 'lessonId' | 'status' | 'isWarned'
> & {
  /** Ученик записан на отработку за этот пропуск. */
  makeupAttendance: { id: number } | null
}

interface AttendanceStatusSwitcherProps {
  attendance: AttendanceForStatusSwitcher
  disabled?: boolean
}

/** Цвет нажатой кнопки. Ненажатая везде обычная, поэтому вариантов ровно три. */
const ACTIVE_STYLE = {
  absent: 'border-destructive aria-pressed:bg-destructive/20 text-destructive',
  present: 'border-success aria-pressed:bg-success/20 text-success',
  // Колокольчик, в отличие от остальных, в нажатом виде не выключен — по нему
  // ещё раз кликают, чтобы снять предупреждение. Значит до него доходит
  // `hover:text-foreground hover:bg-muted` из базового `toggleVariants`, и цвет
  // надо перебить своим, иначе под курсором кнопка белеет.
  warned: 'border-warning aria-pressed:bg-warning/20 text-warning hover:text-warning',
} as const

export function AttendanceStatusSwitcher({ attendance, disabled }: AttendanceStatusSwitcherProps) {
  const { data: hasPermission } = useOrganizationPermissionQuery({
    studentLesson: ['selectWarned'],
  })
  const { mutate, isPending } = useUpdateAttendanceStatusMutation(attendance.lessonId)

  const status = attendance.status
  const isWarned = attendance.isWarned

  const handleStatusChange = (newStatus: AttendanceStatus, newIsWarned: boolean | null) => {
    mutate({
      studentId: attendance.studentId,
      lessonId: attendance.lessonId,
      status: newStatus,
      isWarned: newIsWarned,
    })
  }

  if (disabled) {
    const statusLabel = {
      [AttendanceStatus.PRESENT]: 'Присутствует',
      [AttendanceStatus.ABSENT]: isWarned ? 'Отсутствует (пред.)' : 'Отсутствует',
      [AttendanceStatus.UNSPECIFIED]: 'Не отмечен',
    }
    const statusColor = {
      [AttendanceStatus.PRESENT]: 'text-success',
      [AttendanceStatus.ABSENT]: 'text-destructive',
      [AttendanceStatus.UNSPECIFIED]: 'text-muted-foreground',
    }
    return <span className={`text-sm ${statusColor[status]}`}>{statusLabel[status]}</span>
  }

  // Отработка уже назначена — оригинальный пропуск заморожен: смена статуса
  // оставила бы отработку висеть за занятием, на котором ученик был. Сервер
  // это тоже проверяет (`updateAttendanceStatus`), здесь — чтобы было видно.
  const locked = attendance.makeupAttendance !== null

  return (
    <TooltipProvider delay={300}>
      {/* Подсказка про блокировку — нативным title: у выключенных кнопок
          отключены указатели, и Tooltip на них не открывается. */}
      <div
        className="border-muted flex w-fit items-center gap-1.5 rounded-lg border px-1.5 py-1"
        title={locked ? 'Ученик записан на отработку — статус не меняется' : undefined}
      >
        {/* «Предупредили» бывает только у отсутствия, поэтому на остальных
            статусах колокольчик сворачивается по ширине. Схлопывание через
            grid 1fr→0fr — единственный способ доехать до ширины содержимого,
            не замеряя её в JS; отрицательный отступ убирает `gap` пустой
            ячейки, иначе в свёрнутом виде слева висит лишний зазор. */}
        <div
          // `overflow-hidden` только прячет — свёрнутая кнопка осталась бы
          // в tab-порядке, `inert` убирает её и оттуда, и из дерева доступности.
          inert={status !== 'ABSENT'}
          className={`grid transition-[grid-template-columns,margin-right] duration-200 ${
            status === 'ABSENT' ? 'grid-cols-[1fr]' : '-mr-1.5 grid-cols-[0fr]'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            {/* Колокольчик — сам переключатель «предупредили»: повторный клик
                снимает предупреждение, оставляя отсутствие. */}
            {hasPermission?.success ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Toggle
                      size={'sm'}
                      className={isWarned ? ACTIVE_STYLE.warned : undefined}
                      pressed={isWarned === true}
                      onClick={() => handleStatusChange('ABSENT', !isWarned)}
                      disabled={isPending || locked}
                    >
                      {isPending ? <Loader className="animate-spin" /> : <BellRing />}
                    </Toggle>
                  }
                />

                <TooltipContent>
                  <p>{isWarned ? 'Не предупредили (-1)' : 'Предупредили (0)'}</p>
                </TooltipContent>
              </Tooltip>
            ) : isWarned ? (
              <Tooltip>
                <TooltipTrigger render={<BellRing className="text-warning size-4" />} />
                <TooltipContent>Предупредили</TooltipContent>
              </Tooltip>
            ) : (
              <BellRing className="text-muted size-4" />
            )}

            <Separator orientation="vertical" />
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                size={'sm'}
                className={status === 'ABSENT' ? ACTIVE_STYLE.absent : undefined}
                pressed={status === 'ABSENT'}
                onClick={() => handleStatusChange('ABSENT', false)}
                disabled={isPending || locked || status === 'ABSENT'}
              >
                {isPending ? <Loader className="animate-spin" /> : <X />}
              </Toggle>
            }
          />

          <TooltipContent>
            <p>Отсутствует</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                size={'sm'}
                pressed={status === 'UNSPECIFIED'}
                onClick={() => handleStatusChange('UNSPECIFIED', null)}
                disabled={isPending || locked || status === 'UNSPECIFIED'}
              >
                {isPending ? <Loader className="animate-spin" /> : <Minus />}
              </Toggle>
            }
          />

          <TooltipContent>
            <p>Не отмечен</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                size={'sm'}
                className={status === 'PRESENT' ? ACTIVE_STYLE.present : undefined}
                pressed={status === 'PRESENT'}
                onClick={() => handleStatusChange('PRESENT', null)}
                disabled={isPending || locked || status === 'PRESENT'}
              >
                {isPending ? <Loader className="animate-spin" /> : <Check />}
              </Toggle>
            }
          />

          <TooltipContent>
            <p>Присутствует (-1)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
