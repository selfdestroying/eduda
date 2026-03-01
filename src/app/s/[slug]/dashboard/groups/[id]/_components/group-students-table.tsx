'use client'
import { Prisma } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import { getFullName } from '@/src/lib/utils'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo } from 'react'
import GroupStudentActions from './group-students-actions'

type StudentWithAttendances = Prisma.StudentGroupGetPayload<{
  include: {
    student: {
      include: {
        attendances: {
          where: { lesson: { groupId: number } }
          include: {
            lesson: true
            asMakeupFor: { include: { missedAttendance: { include: { lesson: true } } } }
            missedMakeup: { include: { makeUpAttendance: { include: { lesson: true } } } }
          }
        }
      }
    }
  }
}>

export default function GroupStudentsTable({
  data,
}: {
  data: Prisma.StudentGroupGetPayload<{ include: { student: true } }>[]
}) {
  const { data: hasPermission } = useOrganizationPermissionQuery({
    studentGroup: ['update'],
  })
  const columns: ColumnDef<Prisma.StudentGroupGetPayload<{ include: { student: true } }>>[] =
    useMemo(
      () => [
        {
          id: 'id',
          header: '№',
          cell: ({ row }) => row.index + 1,
          size: 10,
        },
        {
          header: 'Полное имя',
          accessorFn: (sg) => getFullName(sg.student.firstName, sg.student.lastName),
          cell: ({ row }) => (
            <Link
              href={`/dashboard/students/${row.original.student.id}`}
              className="text-primary hover:underline"
            >
              {getFullName(row.original.student.firstName, row.original.student.lastName)}
            </Link>
          ),
        },
        {
          header: 'Ссылка в amo',
          cell: ({ row }) =>
            row.original.student.url ? (
              <a
                href={row.original.student.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {row.original.student.url ? 'Ссылка' : 'Нет ссылки'}
              </a>
            ) : (
              'Нет ссылки'
            ),
        },
        {
          header: 'Возраст',
          cell: ({ row }) => row.original.student.age,
        },
        {
          header: 'Логин',
          cell: ({ row }) => row.original.student.login,
        },
        {
          header: 'Пароль',
          cell: ({ row }) => row.original.student.password,
        },
        {
          header: 'Коины',
          cell: ({ row }) => row.original.student.coins,
        },
        {
          id: 'actions',
          cell: ({ row }) =>
            hasPermission?.success ? <GroupStudentActions sg={row.original} /> : null,
        },
      ],
      [hasPermission?.success],
    )
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} emptyMessage="Нет учеников." />
}
