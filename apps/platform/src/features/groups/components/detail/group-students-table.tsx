'use client'

import DataTable from '@/src/components/data-table'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { getFullName } from '@/src/lib/utils'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo } from 'react'
import type { StudentGroupWithStudent } from '../../types'
import GroupStudentActions from './group-students-actions'

function GroupStudentActionsCell({ sg }: { sg: StudentGroupWithStudent }) {
  const { data: hasPermission } = useOrganizationPermissionQuery({
    studentGroup: ['update'],
  })
  if (!hasPermission) return null

  return <GroupStudentActions sg={sg} />
}

export default function GroupStudentsTable({
  data,
  isActive,
}: {
  data: StudentGroupWithStudent[]
  isActive?: boolean
}) {
  const columns: ColumnDef<StudentGroupWithStudent>[] = useMemo(
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
            href={`/students/${row.original.student.id}`}
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
        id: 'actions',
        cell: ({ row }) => isActive && <GroupStudentActionsCell sg={row.original} />,
      },
    ],
    [isActive],
  )
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} emptyMessage="Нет учеников." />
}
