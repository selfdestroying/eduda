'use client'

import { Prisma } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import RateActions from './rate-actions'

type RateWithCount = Prisma.RateGetPayload<{
  include: { _count: { select: { teacherGroups: true } } }
}>

interface RatesTableProps {
  data: RateWithCount[]
}

function RateActionsCell({ rate }: { rate: RateWithCount }) {
  const { data: canEdit } = useOrganizationPermissionQuery({ rate: ['update'] })
  if (!canEdit?.success) return null
  return <RateActions rate={rate} />
}

const columns: ColumnDef<RateWithCount>[] = [
  {
    header: 'Название',
    accessorKey: 'name',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    header: 'Ставка',
    accessorKey: 'bid',
    cell: ({ row }) => <span className="tabular-nums">{row.original.bid.toLocaleString()} ₽</span>,
  },
  {
    header: 'Бонус за уч.',
    accessorKey: 'bonusPerStudent',
    cell: ({ row }) =>
      row.original.bonusPerStudent > 0 ? (
        <span className="tabular-nums">{row.original.bonusPerStudent} ₽</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    header: 'Привязано групп',
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {row.original._count.teacherGroups}
      </span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <RateActionsCell rate={row.original} />,
  },
]

export default function RatesTable({ data }: RatesTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} emptyMessage="Нет ставок. Создайте первую ставку." />
}
