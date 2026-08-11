'use client'

import { useMemo } from 'react'

import DataTable from '@repo/ui/components/data-table'
import { Hint } from '@repo/ui/components/hint'
import { Badge } from '@repo/ui/components/badge'
import { Input } from '@repo/ui/components/input'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { formatDateOnly } from '@/src/lib/timezone'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { debounce } from 'es-toolkit'
import Link from 'next/link'
import { useUpdateAttendanceCommentMutation } from '../queries'
import type { AttendanceWithStudents } from '../types'
import AttendanceActions from './attendance-actions'
import { AttendanceStatusSwitcher } from './attendance-status-switcher'
import { useLessonDetail } from './lesson-detail-context'

/**
 * Занятие ждёт оплаты: статус платный, а пакета под него не нашлось.
 * Зеркало `UNPAID_ATTENDANCE_WHERE` из `finances/chargeable.server.ts` —
 * строка уже здесь, за ней незачем ходить на сервер.
 */
function isUnpaid(attendance: AttendanceWithStudents): boolean {
  if (attendance.isTrial) return false
  if (attendance.amount !== 0 || attendance.paymentId !== null) return false
  if (attendance.makeupAttendance) return false
  return attendance.status === 'PRESENT' || (attendance.status === 'ABSENT' && !attendance.isWarned)
}

function AttendanceActionsCell({ attendance }: { attendance: AttendanceWithStudents }) {
  const { isCancelled } = useLessonDetail()
  const { data: hasPermission } = useOrganizationPermissionQuery({ studentLesson: ['update'] })
  if (!hasPermission?.success || isCancelled) return null
  return (
    <div className="flex justify-end">
      <AttendanceActions attendance={attendance} />
    </div>
  )
}

export default function AttendanceTable() {
  const { lesson, isCancelled, lessonId } = useLessonDetail()
  const data = lesson.attendance
  const commentMutation = useUpdateAttendanceCommentMutation(lessonId)

  const handleUpdate = useMemo(
    () =>
      debounce((studentId: number, lessonId: number, comment?: string) => {
        commentMutation.mutate({ studentId, lessonId, comment: comment ?? '' })
      }, 500),
    [commentMutation],
  )

  const columns = useMemo<ColumnDef<AttendanceWithStudents>[]>(() => {
    const cols: ColumnDef<AttendanceWithStudents>[] = [
      {
        header: 'Полное имя',
        accessorFn: (value) => value.studentId,
        cell: ({ row }) => {
          return (
            <div className="flex items-center gap-2">
              <Link
                href={`/students/${row.original.studentId}`}
                className="text-primary hover:underline"
              >
                {`${row.original.student.firstName} ${row.original.student.lastName}`}
              </Link>
              {row.original.isTrial && (
                <Badge className="bg-info/10 text-info hover:bg-info/20 select-none">Пробный</Badge>
              )}
              {isUnpaid(row.original) && (
                <Badge
                  variant="destructive"
                  className="select-none"
                  title="Занятие проведено, но оплаты под него не нашлось. Следующая оплата закроет его по своей цене."
                >
                  Не оплачено
                </Badge>
              )}
              {/* Отметка родителя из кабинета: выглядит так же, как отметка
                  преподавателя, но её никто из школы не подтверждал. */}
              {row.original.parentMarkedAt && (
                <Badge
                  variant="secondary"
                  className="bg-amber-500/10 text-amber-600 select-none dark:text-amber-400"
                >
                  Из кабинета
                </Badge>
              )}
            </div>
          )
        },
      },
      {
        header: 'Статус',
        cell: ({ row }) => (
          <AttendanceStatusSwitcher attendance={row.original} disabled={isCancelled} />
        ),
      },
      {
        id: 'makeup',
        header: () => (
          <span className="flex items-center gap-0.5">
            Отработка
            <Hint text="Связь с отработкой: если ученик пропустил урок - ссылка на урок-отработку. Если пришёл на отработку - ссылка на пропущенный урок." />
          </span>
        ),
        cell: ({ row }) =>
          row.original.makeupForAttendance ? (
            <Link
              href={`/lessons/${row.original.makeupForAttendance.lessonId}`}
              className="text-primary hover:underline"
            >
              Отработка за {formatDateOnly(row.original.makeupForAttendance.lesson!.date)}
            </Link>
          ) : row.original.makeupAttendance ? (
            <Link
              href={`/lessons/${row.original.makeupAttendance.lessonId}`}
              className="text-primary hover:underline"
            >
              Отработка {formatDateOnly(row.original.makeupAttendance.lesson!.date)}
            </Link>
          ) : null,
      },
      {
        header: 'Комментарий',
        accessorKey: 'comment',
        cell: ({ row }) =>
          isCancelled ? (
            <span className="text-muted-foreground text-sm">{row.original.comment || '-'}</span>
          ) : (
            <Input
              defaultValue={row.original.comment}
              onChange={(e) =>
                handleUpdate(row.original.studentId, row.original.lessonId, e.target.value)
              }
            />
          ),
      },
    ]

    if (!isCancelled) {
      cols.push({
        id: 'actions',
        cell: ({ row }) => <AttendanceActionsCell attendance={row.original} />,
        size: 50,
      })
    }

    return cols
  }, [isCancelled, handleUpdate])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className={isCancelled ? 'opacity-60' : undefined}>
      <DataTable table={table} emptyMessage="Нет учеников." />
    </div>
  )
}
