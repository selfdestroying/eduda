'use client'

import type { Attendance } from '@/prisma/generated/client'
import { AttendanceStatus } from '@/prisma/generated/enums'
import { Button } from '@/src/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Toggle } from '@/src/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/src/components/ui/tooltip'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { cva } from 'class-variance-authority'
import { BellRing, Check, Loader, Minus, X } from 'lucide-react'
import { useState } from 'react'
import { useUpdateAttendanceStatusMutation } from '../queries'
import { Separator } from '@/src/components/ui/separator'

export type AttendanceForStatusSwitcher = Pick<
  Attendance,
  'studentId' | 'lessonId' | 'status' | 'isWarned'
>

interface AttendanceStatusSwitcherProps {
  attendance: AttendanceForStatusSwitcher
  disabled?: boolean
  /** Контейнер для портала popover'а — нужен внутри модальных drawer'ов (vaul блокирует клики вне контента). */
  popoverContainer?: HTMLElement | null
}

const switcherVariant = cva(['cursor-pointer'], {
  variants: {
    variant: {
      absent: {},
      present: {},
      unspecified: {},
    },
    active: {
      true: {},
      false: {},
    },
  },
  compoundVariants: [
    {
      variant: 'absent',
      active: true,
      className:
        'border-destructive aria-pressed:bg-destructive/20 text-destructive aria-pressed:opacity-100',
    },
    {
      variant: 'absent',
      active: false,
      className: '',
    },
    {
      variant: 'present',
      active: true,
      className: 'border-success aria-pressed:bg-success/20 text-success aria-pressed:opacity-100',
    },
    {
      variant: 'present',
      active: false,
      className: '',
    },
    {
      variant: 'unspecified',
      active: true,
      className: '',
    },
    {
      variant: 'unspecified',
      active: false,
      className: '',
    },
  ],
})

export function AttendanceStatusSwitcher({
  attendance,
  disabled,
  popoverContainer,
}: AttendanceStatusSwitcherProps) {
  const { data: hasPermission } = useOrganizationPermissionQuery({
    studentLesson: ['selectWarned'],
  })
  const { mutate, isPending } = useUpdateAttendanceStatusMutation(attendance.lessonId)
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false)

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
    return (
      <span className={`text-sm ${statusColor[attendance.status]}`}>
        {statusLabel[attendance.status]}
      </span>
    )
  }

  return (
    <TooltipProvider delay={300}>
      <div className="border-muted flex w-fit items-center gap-1.5 rounded-lg border px-1.5 py-1">
        {hasPermission?.success ? (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <PopoverTrigger
                    render={
                      <Toggle
                        size={'sm'}
                        className={switcherVariant({
                          variant: 'absent',
                          active: status === 'ABSENT',
                        })}
                        pressed={status === 'ABSENT'}
                        disabled={isPending || status === 'ABSENT'}
                      >
                        {isPending ? <Loader className="animate-spin" /> : <X />}
                      </Toggle>
                    }
                  />
                }
              />

              <TooltipContent>
                <p>Отсутствует</p>
              </TooltipContent>
            </Tooltip>

            <PopoverContent className="w-fit" container={popoverContainer}>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant={'destructive'}
                  onClick={() => {
                    handleStatusChange('ABSENT', false)
                    setPopoverOpen(false)
                  }}
                >
                  Не предупредили (-1)
                </Button>
                <Button
                  className="bg-success/10 text-success hover:bg-success/20"
                  onClick={() => {
                    handleStatusChange('ABSENT', true)
                    setPopoverOpen(false)
                  }}
                >
                  Предупредили (0)
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  size={'sm'}
                  className={switcherVariant({
                    variant: 'absent',
                    active: status === 'ABSENT',
                  })}
                  pressed={status === 'ABSENT'}
                  onClick={() => handleStatusChange('ABSENT', false)}
                  disabled={isPending || status === 'ABSENT'}
                >
                  {isPending ? <Loader className="animate-spin" /> : <X />}
                </Toggle>
              }
            />

            <TooltipContent>
              <p>Отсутствует</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                size={'sm'}
                className={switcherVariant({ variant: 'unspecified', active: isPending })}
                pressed={status === 'UNSPECIFIED'}
                onClick={() => handleStatusChange('UNSPECIFIED', null)}
                disabled={isPending || status === 'UNSPECIFIED'}
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
            className={switcherVariant({ variant: 'present', active: status === 'PRESENT' })}
            render={
              <Toggle
                size={'sm'}
                pressed={status === 'PRESENT'}
                onClick={() => handleStatusChange('PRESENT', null)}
                disabled={isPending || status === 'PRESENT'}
              >
                {isPending ? <Loader className="animate-spin" /> : <Check />}
              </Toggle>
            }
          />

          <TooltipContent>
            <p>Присутствует (-1)</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" />

        {isWarned !== null && isWarned ? (
          <Tooltip>
            <TooltipTrigger render={<BellRing className="text-warning size-4" />} />
            <TooltipContent>Предупредили</TooltipContent>
          </Tooltip>
        ) : (
          <BellRing className="text-muted size-4" />
        )}
      </div>
    </TooltipProvider>
  )
}
