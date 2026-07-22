'use client'

import DataTable from '@/src/components/data-table'
import { Hint } from '@/src/components/hint'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import BalanceBadge from '@/src/features/lessons/components/balance-badge'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo } from 'react'
import type { TeacherGroupWithRate } from '../../types'
import GroupTeacherActions from './group-teachers-actions'

function GroupTeacherActionsCell({ tg }: { tg: TeacherGroupWithRate }) {
  const { data: canEdit } = useOrganizationPermissionQuery({ teacherGroup: ['update'] })
  if (!canEdit?.success) return null
  return <GroupTeacherActions tg={tg} />
}

export default function GroupTeachersTable({
  data,
  isActive,
}: {
  data: TeacherGroupWithRate[]
  isActive?: boolean
}) {
  const columns: ColumnDef<TeacherGroupWithRate>[] = useMemo(
    () => [
      {
        header: 'Преподаватель',
        cell: ({ row }) => (
          <Link
            href={`/organization/members/${row.original.teacher.id}`}
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
        id: 'bonusPerStudent',
        header: () => (
          <span className="flex items-center gap-0.5">
            Бонус за уч.
            <Hint text="Доплата преподавателю за каждого присутствующего ученика. Итого за урок = ставка + (бонус × кол-во учеников)." />
          </span>
        ),
        cell: ({ row }) => <BalanceBadge balance={row.original.rate.bonusPerStudent} />,
      },
      {
        id: 'actions',
        cell: ({ row }) => isActive && <GroupTeacherActionsCell tg={row.original} />,
      },
    ],
    [isActive],
  )
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} emptyMessage="Нет преподавателей." />
}
