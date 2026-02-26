'use client'
import { useMemo } from 'react'

import { AttendanceStatus, StudentStatus } from '@/prisma/generated/enums'
import { AttendanceWithStudents, updateAttendanceComment } from '@/src/actions/attendance'
import DataTable from '@/src/components/data-table'
import { Input } from '@/src/components/ui/input'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import useSkipper from '@/src/hooks/use-skipper'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { formatDateOnly } from '@/src/lib/timezone'
import { debounce, DebouncedFunction } from 'es-toolkit'
import Link from 'next/link'
import { toast } from 'sonner'
import AttendanceActions from './attendance-actions'
import { AttendanceStatusSwitcher } from './attendance-status-switcher'

export const StudentStatusMap: { [key in StudentStatus]: string } = {
  ACTIVE: 'Ученик',
  DISMISSED: 'Отчислен',
  TRIAL: 'Пробный',
}

const getColumns = (
  handleUpdate: DebouncedFunction<
    (studentId: number, lessonId: number, comment?: string, status?: AttendanceStatus) => void
  >
): ColumnDef<AttendanceWithStudents>[] => {
  return [
    {
      header: 'Полное имя',
      accessorFn: (value) => value.studentId,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/students/${row.original.studentId}`}
          className="text-primary hover:underline"
        >
          {`${row.original.student.firstName} ${row.original.student.lastName}`}
        </Link>
      ),
    },
    {
      header: 'Статус ученика',
      cell: ({ row }) => StudentStatusMap[row.original.studentStatus],
    },
    {
      header: 'Статус',
      cell: ({ row }) => <AttendanceStatusSwitcher attendance={row.original} />,
    },
    {
      header: 'Отработка',
      cell: ({ row }) =>
        row.original.asMakeupFor ? (
          <Link
            href={`/dashboard/lessons/${row.original.asMakeupFor.missedAttendance.lessonId}`}
            className="text-primary hover:underline"
          >
            Отработка за{' '}
            {formatDateOnly(row.original.asMakeupFor.missedAttendance.lesson!.date)}
          </Link>
        ) : row.original.missedMakeup ? (
          <Link
            href={`/dashboard/lessons/${row.original.missedMakeup.makeUpAttendance.lessonId}`}
            className="text-primary hover:underline"
          >
            Отработка{' '}
            {formatDateOnly(row.original.missedMakeup.makeUpAttendance.lesson!.date)}
          </Link>
        ) : null,
    },
    {
      header: 'Комментарий',
      accessorKey: 'comment',
      cell: ({ row }) => (
        <Input
          defaultValue={row.original.comment}
          onChange={(e) =>
            handleUpdate(row.original.studentId, row.original.lessonId, e.target.value)
          }
        />
      ),
    },
  ]
}

export default function AttendanceTable({ data }: { data: AttendanceWithStudents[] }) {
  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper()
  const handleUpdate = useMemo(
    () =>
      debounce((studentId: number, lessonId: number, comment?: string) => {
        skipAutoResetPageIndex()
        const ok = updateAttendanceComment({
          where: {
            studentId_lessonId: {
              studentId: studentId,
              lessonId: lessonId,
            },
          },
          data: {
            comment,
          },
        })
        toast.promise(ok, {
          loading: 'Загрузка...',
          success: 'Успешно!',
          error: (e) => e.message,
        })
      }, 500),
    [skipAutoResetPageIndex]
  )
  const columns = getColumns(handleUpdate)

  const { data: hasPermission } = useOrganizationPermissionQuery({ studentLesson: ['update'] })

  if (hasPermission?.success) {
    columns.push({
      id: 'actions',

      cell: ({ row }) => (
        <div className="flex justify-end">
          <AttendanceActions attendance={row.original} />
        </div>
      ),
      size: 50,
    })
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    autoResetPageIndex,
  })

  return <DataTable table={table} emptyMessage="Нет учеников." />
}
