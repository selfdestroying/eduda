'use client'

import { useTableState } from '@/src/hooks/use-table-state'
import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
import { formatDateOnly } from '@/src/lib/timezone'
import { getFullName } from '@/src/lib/utils'
import { Badge } from '@repo/ui/components/badge'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Input } from '@repo/ui/components/input'
import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { debounce } from 'es-toolkit'
import Link from 'next/link'
import { useMemo } from 'react'
import { useUpdateAttendanceCommentMutation } from '../queries'
import type { AttendanceWithStudents } from '../types'
import AttendanceActions from './attendance-actions'
import { AttendanceStatusSwitcher } from './attendance-status-switcher'
import { useLessonDetail } from './lesson-detail-context'

/** Ширина колонок с известным потолком длины — статуса и отработки. */
const COLUMN_WIDTH = 150
const MAKEUP_WIDTH = 200

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/** Пауза, через которую набранный комментарий уходит на сервер. */
const COMMENT_DELAY_MS = 500

/**
 * Вне компонента: `useHasPermission` мемоизирует по ссылке на объект, и литерал
 * внутри пересчитывал бы проверку на каждый рендер.
 */
const EDIT_PERMISSION = { studentLesson: ['update'] } as const

/**
 * Занятие ждёт оплаты: статус платный, а пакета под него не нашлось.
 * Зеркало `UNPAID_ATTENDANCE_WHERE` из `finances/chargeable.server.ts` —
 * строка уже здесь, за ней незачем ходить на сервер.
 */
function isUnpaid(attendance: AttendanceWithStudents): boolean {
  if (attendance.isTrial) return false
  if (attendance.price !== null || attendance.packageId !== null) return false
  if (attendance.makeupAttendance) return false
  return attendance.status === 'PRESENT' || (attendance.status === 'ABSENT' && !attendance.isWarned)
}

interface ColumnOptions {
  isCancelled: boolean
  canEdit: boolean
  onComment: (studentId: number, lessonId: number, comment: string) => void
}

function buildColumns({
  isCancelled,
  canEdit,
  onComment,
}: ColumnOptions): ColumnDef<AttendanceWithStudents>[] {
  const columns: ColumnDef<AttendanceWithStudents>[] = [
    {
      id: 'student',
      header: 'Полное имя',
      accessorFn: (row) => getFullName(row.student.firstName, row.student.lastName),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/students/${row.original.studentId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline"
          >
            {getFullName(row.original.student.firstName, row.original.student.lastName)}
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
      ),
      meta: { title: 'Полное имя', flexible: true },
      // Строка без ученика бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'status',
      header: 'Статус',
      accessorKey: 'status',
      size: COLUMN_WIDTH,
      cell: ({ row }) => (
        <AttendanceStatusSwitcher attendance={row.original} disabled={isCancelled} />
      ),
      meta: { title: 'Статус' },
    },
    {
      id: 'makeup',
      header: 'Отработка',
      size: MAKEUP_WIDTH,
      enableSorting: false,
      cell: ({ row }) => {
        const { makeupForAttendance, makeupAttendance } = row.original
        if (makeupForAttendance) {
          return (
            <Link
              href={`/lessons/${makeupForAttendance.lessonId}`}
              className="text-primary hover:underline"
            >
              Отработка за {formatDateOnly(makeupForAttendance.lesson!.date)}
            </Link>
          )
        }
        if (makeupAttendance) {
          return (
            <Link
              href={`/lessons/${makeupAttendance.lessonId}`}
              className="text-primary hover:underline"
            >
              Отработка {formatDateOnly(makeupAttendance.lesson!.date)}
            </Link>
          )
        }
        return '—'
      },
      meta: { title: 'Отработка' },
    },
    {
      id: 'comment',
      header: 'Комментарий',
      accessorKey: 'comment',
      enableSorting: false,
      cell: ({ row }) =>
        isCancelled ? (
          <span className="text-muted-foreground text-sm">{row.original.comment || '—'}</span>
        ) : (
          <Input
            defaultValue={row.original.comment}
            aria-label="Комментарий к посещению"
            onChange={(e) =>
              onComment(row.original.studentId, row.original.lessonId, e.target.value)
            }
          />
        ),
      meta: { title: 'Комментарий', flexible: true },
    },
  ]

  if (!isCancelled && canEdit) {
    columns.push({
      id: 'actions',
      header: () => null,
      size: ACTIONS_WIDTH,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <AttendanceActions attendance={row.original} />
        </div>
      ),
    })
  }

  return columns
}

/**
 * Отметки на одном уроке: строк единицы, поэтому без пагинации и без похода на
 * сервер — данные уже пришли с карточкой урока.
 */
export default function AttendanceTable() {
  const { lesson, isCancelled, lessonId } = useLessonDetail()
  const canEdit = useHasPermission(EDIT_PERMISSION)
  const commentMutation = useUpdateAttendanceCommentMutation(lessonId)
  const t = useTableState({ id: 'lesson-attendance', prefix: 'la_' })

  // Комментарий уходит на сервер, когда ввод затих: иначе каждое нажатие клавиши
  // было бы отдельной мутацией.
  const onComment = useMemo(
    () =>
      debounce((studentId: number, targetLessonId: number, comment: string) => {
        commentMutation.mutate({ studentId, lessonId: targetLessonId, comment })
      }, COMMENT_DELAY_MS),
    [commentMutation],
  )

  const columns = useMemo(
    () => buildColumns({ isCancelled, canEdit, onComment }),
    [isCancelled, canEdit, onComment],
  )

  const table = useReactTable({
    data: lesson.attendance,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Ключ строки — пара «ученик + урок», а не индекс: иначе при сортировке React
    // переиспользовал бы поле комментария под чужого ученика.
    getRowId: (row) => `${row.studentId}-${row.lessonId}`,
    globalFilterFn: (row, _columnId, filterValue) =>
      getFullName(row.original.student.firstName, row.original.student.lastName)
        .toLowerCase()
        .includes(String(filterValue).toLowerCase()),
    onSortingChange: t.setSorting,
    onColumnVisibilityChange: t.setColumnVisibility,
    state: {
      globalFilter: t.globalFilter,
      sorting: t.sorting,
      columnVisibility: t.columnVisibility,
    },
  })

  return (
    <div className={isCancelled ? 'opacity-60' : undefined}>
      <DataTable
        table={table}
        emptyMessage="Нет учеников."
        showColumnVisibility
        toolbar={
          <DataTableToolbar
            table={table}
            search={t.globalFilter}
            onSearchChange={t.setGlobalFilter}
            searchPlaceholder="Имя ученика..."
            onReset={t.reset}
          />
        }
      />
    </div>
  )
}
