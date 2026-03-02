'use client'
import { Prisma } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import BalanceBadge from './balance-badge'
import LessonTeacherActions from './lesson-teachers-actions'

type TeacherLessonRow = Prisma.TeacherLessonGetPayload<{ include: { teacher: true } }>

function ActionsCell({ tl }: { tl: TeacherLessonRow }) {
  const { data: canEdit } = useOrganizationPermissionQuery({ teacherLesson: ['update'] })
  if (!canEdit?.success) return null
  return <LessonTeacherActions tl={tl} />
}

const columns: ColumnDef<TeacherLessonRow>[] = [
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
    cell: ({ row }) => <ActionsCell tl={row.original} />,
  },
]

export default function LessonTeachersTable({ data }: { data: TeacherLessonRow[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} emptyMessage="Нет преподавателей." />
}
