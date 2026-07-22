'use client'

import DataTable from '@/src/components/data-table'
import { Hint } from '@/src/components/hint'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useRateListQuery } from '../queries'
import type { RateWithCount } from '../types'
import RateActions from './rate-actions'

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
    header: () => (
      <span className="flex items-center gap-0.5">
        Бонус за уч.
        <Hint text="Дополнительная надбавка к ставке преподавателя за каждого присутствующего ученика на уроке." />
      </span>
    ),
    accessorKey: 'bonusPerStudent',
    cell: ({ row }) =>
      row.original.bonusPerStudent > 0 ? (
        <span className="tabular-nums">{row.original.bonusPerStudent} ₽</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: 'linkedGroups',
    header: () => (
      <span className="flex items-center gap-0.5">
        Привязано групп
        <Hint text="Количество связей «преподаватель - группа», использующих эту ставку." />
      </span>
    ),
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

export default function RatesTable() {
  const { data: rates = [], isLoading, isError } = useRateListQuery()

  const table = useReactTable({
    data: rates,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (isError) return <div className="text-destructive">Ошибка загрузки</div>

  return <DataTable table={table} emptyMessage="Нет ставок. Создайте первую ставку." />
}
