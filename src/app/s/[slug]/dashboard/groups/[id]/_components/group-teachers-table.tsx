'use client'
import { Prisma } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo } from 'react'
import BalanceBadge from '../../../lessons/[id]/_components/balance-badge'
import GroupTeacherActions from './group-teachers-actions'

type TeacherGroupWithRate = Prisma.TeacherGroupGetPayload<{
  include: { teacher: true; rate: true }
}>

export default function GroupTeachersTable({ data }: { data: TeacherGroupWithRate[] }) {
  const { data: canEdit } = useOrganizationPermissionQuery({ teacherGroup: ['update'] })
  const columns: ColumnDef<TeacherGroupWithRate>[] = useMemo(
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
        cell: ({ row }) => <BalanceBadge balance={row.original.rate.bid} />,
      },
      {
        header: 'Бонус за уч.',
        cell: ({ row }) => <BalanceBadge balance={row.original.rate.bonusPerStudent} />,
      },
      {
        id: 'actions',
        cell: ({ row }) => (canEdit?.success ? <GroupTeacherActions tg={row.original} /> : null),
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
