'use client'

import DataTable from '@/src/components/data-table'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useGroupTypeListQuery } from '../queries'
import type { GroupTypeWithRelations } from '../types'
import GroupTypeActions from './group-type-actions'

function GroupTypeActionsCell({ groupType }: { groupType: GroupTypeWithRelations }) {
  const { data: canEdit } = useOrganizationPermissionQuery({ groupType: ['update'] })
  if (!canEdit?.success) return null
  return <GroupTypeActions groupType={groupType} />
}

export default function GroupTypesTable() {
  const { data: groupTypes = [], isLoading } = useGroupTypeListQuery()

  const columns: ColumnDef<GroupTypeWithRelations>[] = useMemo(
    () => [
      {
        header: 'Название',
        accessorKey: 'name',
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        header: 'Ставка',
        cell: ({ row }) => {
          const rate = row.original.rate
          return (
            <span className="tabular-nums">
              {rate.name} ({rate.bid.toLocaleString()} ₽
              {rate.bonusPerStudent > 0 ? ` + ${rate.bonusPerStudent} ₽/уч.` : ''})
            </span>
          )
        },
      },
      {
        header: 'Групп',
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">{row.original._count.groups}</span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => <GroupTypeActionsCell groupType={row.original} />,
      },
    ],
    [],
  )

  const table = useReactTable({
    data: groupTypes,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) return <div className="text-muted-foreground p-4">Загрузка...</div>

  return <DataTable table={table} emptyMessage="Нет типов групп. Создайте первый тип группы." />
}
