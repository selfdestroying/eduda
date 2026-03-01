'use client'
import { Prisma } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo } from 'react'
import BalanceBadge from './balance-badge'
import LessonTeacherActions from './lesson-teachers-actions'

export default function LessonTeachersTable({
  data,
}: {
  data: Prisma.TeacherLessonGetPayload<{ include: { teacher: true } }>[]
}) {
  const { data: canEdit } = useOrganizationPermissionQuery({ teacherLesson: ['update'] })
  const columns: ColumnDef<Prisma.TeacherLessonGetPayload<{ include: { teacher: true } }>>[] =
    useMemo(
      () => [
        {
          header: 'Преподаватель',
          cell: ({ row }) => (
            <Link
              href={`/dashboard/organization/members/${row.original.teacher.id}`}
              className="text-primary hover:underline"
            >
              {row.original.teacher.name}
            </Link>
          ),
        },
        {
          header: 'Ставка',
          cell: ({ row }) => <BalanceBadge balance={row.original.bid} />,
        },
        {
          header: 'Бонус за уч.',
          cell: ({ row }) => <BalanceBadge balance={row.original.bonusPerStudent} />,
        },
        {
          id: 'actions',
          cell: ({ row }) => (canEdit?.success ? <LessonTeacherActions tl={row.original} /> : null),
        },
      ],
      [canEdit],
    )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} emptyMessage="Нет преподавателей." />
}
