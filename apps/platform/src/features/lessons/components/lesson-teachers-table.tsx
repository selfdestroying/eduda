'use client'

import DataTable from '@/src/components/data-table'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import type { TeacherLessonRow } from '../types'
import BalanceBadge from './balance-badge'
import { useLessonDetail } from './lesson-detail-context'
import LessonTeacherActions from './lesson-teachers-actions'

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
        href={`/organization/members/${row.original.teacher.id}`}
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

export default function LessonTeachersTable() {
  const { lesson } = useLessonDetail()
  const data = lesson.teachers

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} emptyMessage="Нет преподавателей." />
}
