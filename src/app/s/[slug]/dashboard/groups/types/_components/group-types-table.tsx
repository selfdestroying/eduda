'use client'

import { Prisma, Rate } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo } from 'react'
import GroupTypeActions from './group-type-actions'

type GroupTypeWithRelations = Prisma.GroupTypeGetPayload<{
  include: {
    rate: true
    _count: { select: { groups: true } }
  }
}>

interface GroupTypesTableProps {
  data: GroupTypeWithRelations[]
  rates: Rate[]
}

export default function GroupTypesTable({ data, rates }: GroupTypesTableProps) {
  const { data: canEdit } = useOrganizationPermissionQuery({ groupType: ['update'] })

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
        cell: ({ row }) =>
          canEdit?.success ? <GroupTypeActions groupType={row.original} rates={rates} /> : null,
      },
    ],
    [canEdit, rates],
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} emptyMessage="Нет типов групп. Создайте первый тип группы." />
}
