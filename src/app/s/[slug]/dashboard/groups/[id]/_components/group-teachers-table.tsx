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

export default function GroupTeachersTable({
  data,
}: {
  data: TeacherGroupWithRate[]
}) {
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
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-xs font-medium">{row.original.rate.name}</span>
            <span className="text-muted-foreground text-xs">
              <BalanceBadge balance={row.original.rate.bid} />
              {row.original.rate.bonusPerStudent > 0 && (
                <span> + {row.original.rate.bonusPerStudent} ₽/уч.</span>
              )}
            </span>
          </div>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (canEdit?.success ? <GroupTeacherActions tg={row.original} /> : null),
      },
    ],
    [canEdit]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} emptyMessage="Нет преподавателей." />
}
