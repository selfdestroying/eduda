'use client'

import CourseLocationTeacherFilters from '@/src/components/course-location-teacher-filters'
import DataTable from '@/src/components/data-table'
import { NumberInput } from '@/src/components/number-input'
import { Badge } from '@/src/components/ui/badge'
import { Field, FieldGroup } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { DaysOfWeek, getGroupName } from '@/src/lib/utils'
import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { parseAsInteger, useQueryState } from 'nuqs'
import { useMemo } from 'react'
import { useGroupListQuery } from '../queries'
import type { GroupWithRelations } from '../types'

const groupStatusConfig: Record<
  Exclude<GroupWithRelations['status'], 'ACTIVE'>,
  { label: string; variant: 'secondary' | 'success'; className?: string }
> = {
  ARCHIVED: {
    label: 'Архивная',
    variant: 'secondary',
    className: 'text-muted-foreground',
  },
  COMPLETED: {
    label: 'Завершена',
    variant: 'success',
  },
}

const columns: ColumnDef<GroupWithRelations>[] = [
  {
    header: 'Группа',
    accessorFn: (value) => value.id,
    cell: ({ row }) => {
      const statusConfig =
        row.original.status === 'ACTIVE' ? null : groupStatusConfig[row.original.status]

      return (
        <div className="flex items-center gap-2">
          <Link href={`/groups/${row.original.id}`} className="text-primary hover:underline">
            {getGroupName(row.original)}
          </Link>
          {statusConfig && (
            <Badge variant={statusConfig.variant} className={statusConfig.className}>
              {statusConfig.label}
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    header: 'Расписание',
    accessorKey: 'schedules',
    cell: ({ row }) => {
      const schedules = row.original.schedules
      if (schedules.length > 0) {
        const sorted = [...schedules].sort(
          (a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7),
        )
        return (
          <div className="flex flex-col gap-0.5">
            {sorted.map((s) => (
              <span key={s.dayOfWeek} className="text-sm">
                {DaysOfWeek.short[s.dayOfWeek]} {s.time}
              </span>
            ))}
          </div>
        )
      }
      return '-'
    },
  },
  {
    id: 'course',
    header: 'Курс',
    accessorFn: (value) => value.courseId,
    cell: ({ row }) => row.original.course.name,
    filterFn: (row, id, filterValue) => {
      return filterValue.length === 0 || filterValue.includes(row.original.course.id)
    },
  },
  {
    id: 'teacher',
    header: 'Учителя',
    cell: ({ row }) => (
      <div className="flex gap-x-1">
        {row.original.teachers.length === 0 ? (
          <span>-</span>
        ) : (
          row.original.teachers.map((t, index) => (
            <span key={t.teacher.id}>
              <Link
                href={`/organization/members/${t.teacher.id}`}
                className="text-primary hover:underline"
              >
                {t.teacher.name}
              </Link>
              {index < row.original.teachers.length - 1 && ', '}
            </span>
          ))
        )}
      </div>
    ),
    filterFn: (row, columnId, filterValue) => {
      const teacherIds = row.original.teachers.map((t) => t.teacher.id)
      return (
        filterValue.length === 0 || teacherIds.some((teacherId) => filterValue.includes(teacherId))
      )
    },
  },
  {
    id: 'studentCount',
    header: 'Учеников',
    accessorFn: (value) => value.students.length,
    filterFn: (row, columnId, filterValue) => {
      const [min, max] = filterValue || []
      const value = row.getValue(columnId) as number
      if (min !== undefined && value < min) return false
      if (max !== undefined && value > max) return false
      return true
    },
  },
  {
    id: 'location',
    header: 'Локация',
    accessorFn: (value) => value.location?.id,
    cell: ({ row }) => row.original.location?.name,
    filterFn: (row, columnId, filterValue) => {
      return filterValue.length === 0 || filterValue.includes(row.original.location?.id)
    },
  },
  {
    header: 'Тип',
    accessorFn: (value) => value.groupType?.name ?? '-',
  },
  {
    header: 'Ссылка в БО',
    accessorKey: 'url',
    cell: ({ row }) => (
      <a
        href={row.original.url || ''}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary truncate hover:underline"
      >
        Ссылка
      </a>
    ),
  },
]

export default function GroupsTable() {
  const { data: groups = [], isLoading } = useGroupListQuery()

  const {
    columnFilters: baseColumnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    sorting,
    setSorting,
  } = useTableSearchParams({
    filters: { course: 'integer', location: 'integer', teacher: 'integer' },
  })

  // Student count range filter - managed separately via URL params
  const [scMin, setScMin] = useQueryState(
    'scMin',
    parseAsInteger.withOptions({ shallow: true, throttleMs: 300 }),
  )
  const [scMax, setScMax] = useQueryState(
    'scMax',
    parseAsInteger.withOptions({ shallow: true, throttleMs: 300 }),
  )

  // Combine base column filters with studentCount range filter
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const filters = [...baseColumnFilters]
    if (scMin !== null || scMax !== null) {
      filters.push({
        id: 'studentCount',
        value: [scMin ?? undefined, scMax ?? undefined],
      })
    }
    return filters
  }, [baseColumnFilters, scMin, scMax])

  const table = useReactTable({
    data: groups,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      const groupName = getGroupName(row.original).toLowerCase()
      return groupName.includes(searchValue)
    },
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      columnFilters,
      globalFilter,
      pagination,
      sorting,
    },
  })

  if (isLoading) {
    return <div className="text-muted-foreground p-4 text-center text-sm">Загрузка...</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет групп."
      showPagination
      toolbar={
        <FieldGroup className="flex flex-col items-end gap-2 md:flex-row">
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Поиск..."
          />
          <Field>
            <NumberInput
              placeholder="От..."
              value={scMin ?? ''}
              onChange={(v) => setScMin(v === '' ? null : v)}
            />
          </Field>
          <Field>
            <NumberInput
              placeholder="До..."
              value={scMax ?? ''}
              onChange={(v) => setScMax(v === '' ? null : v)}
            />
          </Field>
          <CourseLocationTeacherFilters
            columnFilters={baseColumnFilters}
            setFilters={setColumnFilters}
          />
        </FieldGroup>
      }
    />
  )
}
