'use client'
import {
  AttendanceStatus,
  StudentFinancialField,
  StudentLessonsBalanceChangeReason,
  User,
} from '@/prisma/generated/client'
import { updateStudentBalanceHistory } from '@/src/actions/students'
import DataTable from '@/src/components/data-table'
import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { JsonValue } from '@prisma/client/runtime/client'
import {
  ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { toMoscow } from '@/src/lib/timezone'
import { MoreVertical, RussianRuble } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type HistoryRow = {
  id: number
  createdAt: Date
  field: StudentFinancialField
  reason: StudentLessonsBalanceChangeReason
  delta: number
  balanceBefore: number
  balanceAfter: number
  comment: string | null
  actorUser: User | null
  meta: JsonValue | null
  group: {
    id: number
    course: { name: string }
    location?: { name: string } | null
    dayOfWeek?: number | null
    time?: string | null
  } | null
}

const reasonLabel: Record<StudentLessonsBalanceChangeReason, string> = {
  PAYMENT_CREATED: 'Оплата (начисление уроков)',
  PAYMENT_CANCELLED: 'Отмена оплаты (списание уроков)',
  ATTENDANCE_PRESENT_CHARGED: 'Посещение (списание урока)',
  ATTENDANCE_ABSENT_CHARGED: 'Пропуск (списание урока)',
  MAKEUP_ATTENDED_CHARGED: 'Посещение отработки (списание урока)',
  ATTENDANCE_REVERTED: 'Возврат списания (изменение посещения)',
  MAKEUP_GRANTED: 'Отработка (начисление урока)',
  MANUAL_SET: 'Ручная правка',
  TOTAL_PAYMENTS_MANUAL_SET: 'Ручная правка (сумма оплат)',
  TOTAL_LESSONS_MANUAL_SET: 'Ручная правка (всего уроков)',
  BALANCE_REDISTRIBUTED: 'Перераспределение баланса',
}

const fieldLabel: Record<StudentFinancialField, string> = {
  LESSONS_BALANCE: 'Баланс уроков',
  TOTAL_PAYMENTS: 'Сумма оплат',
  TOTAL_LESSONS: 'Всего уроков',
}

const statusLabel: Record<AttendanceStatus, string> = {
  PRESENT: 'Присутствовал',
  ABSENT: 'Отсутствовал',
  UNSPECIFIED: 'Не указано',
}

type PaymentMeta = {
  lessonCount: number
  price: number
  leadName?: string
  productName?: string
  paymentId?: number
}

type AttendanceMeta = {
  lessonId: number
  lessonName?: string
  newStatus: AttendanceStatus
  oldStatus: AttendanceStatus
  newIsWarned: boolean | null
  oldIsWarned: boolean | null
  attendanceId: number
  isMakeupAttendance: boolean
}

type MakeupGrantedMeta = {
  makeUpLessonId: number
  makeUpLessonName?: string
  makeUpAttendanceId: number
  missedAttendanceId: number
}

function getMetaDetails(
  reason: StudentLessonsBalanceChangeReason,
  meta: JsonValue | null
): React.ReactNode {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null

  const m = meta as Record<string, unknown>

  switch (reason) {
    case 'PAYMENT_CREATED':
    case 'PAYMENT_CANCELLED': {
      const paymentMeta = m as PaymentMeta
      const parts: string[] = []
      if (paymentMeta.lessonCount) parts.push(`${paymentMeta.lessonCount} ур.`)
      if (paymentMeta.price) parts.push(`${paymentMeta.price} ₽`)
      if (paymentMeta.productName) parts.push(paymentMeta.productName)
      return parts.length > 0 ? (
        <span className="text-muted-foreground text-sm">{parts.join(' · ')}</span>
      ) : null
    }

    case 'ATTENDANCE_PRESENT_CHARGED':
    case 'ATTENDANCE_ABSENT_CHARGED':
    case 'ATTENDANCE_REVERTED':
    case 'MAKEUP_ATTENDED_CHARGED': {
      const attendanceMeta = m as AttendanceMeta

      return (
        <Link
          href={`/dashboard/lessons/${attendanceMeta.lessonId}`}
          className="text-primary hover:underline"
        >
          {attendanceMeta.lessonName ?? `Урок #${attendanceMeta.lessonId}`}
        </Link>
      )
    }

    case 'MAKEUP_GRANTED': {
      const makeupMeta = m as MakeupGrantedMeta
      return (
        <Link
          href={`/dashboard/lessons/${makeupMeta.makeUpLessonId}`}
          className="text-primary hover:underline"
        >
          {makeupMeta.makeUpLessonName ?? `Урок #${makeupMeta.makeUpLessonId}`}
        </Link>
      )
    }

    case 'MANUAL_SET':
    default:
      return null
  }
}

export default function LessonsBalanceHistory({ history }: { history: HistoryRow[] }) {
  const table = useReactTable({
    data: history,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <RussianRuble size={20} />
        Финансовая история
      </h3>
      <DataTable table={table} emptyMessage="Пока нет изменений." showPagination />
    </div>
  )
}

const columns: ColumnDef<HistoryRow>[] = [
  {
    header: 'Дата',
    accessorFn: (row) => row.createdAt,
    cell: ({ row }) => (
      <span>
        {toMoscow(row.original.createdAt).toLocaleString('ru-RU')}
      </span>
    ),
  },
  {
    header: 'Группа',
    cell: ({ row }) => {
      const group = row.original.group
      if (!group) return <span className="text-muted-foreground">—</span>
      const name = group.course.name + (group.location ? ` (${group.location.name})` : '')
      return (
        <Link href={`/dashboard/groups/${group.id}`} className="text-primary hover:underline">
          {name}
        </Link>
      )
    },
  },
  {
    header: 'Поле',
    accessorFn: (row) => row.field,
    cell: ({ row }) => fieldLabel[row.original.field] ?? row.original.field,
  },
  {
    header: 'Причина',
    accessorFn: (row) => row.reason,
    cell: ({ row }) => reasonLabel[row.original.reason] ?? row.original.reason,
  },
  {
    header: 'Детали',
    cell: ({ row }) => getMetaDetails(row.original.reason, row.original.meta),
  },
  {
    header: 'Кем',
    cell: ({ row }) => {
      const actor = row.original.actorUser ? row.original.actorUser.name : 'Система'
      return row.original.actorUser ? (
        <Link
          href={`/dashboard/users/${row.original.actorUser.id}`}
          className="text-primary hover:underline"
        >
          {actor}
        </Link>
      ) : (
        actor
      )
    },
  },
  {
    header: 'Комментарий',
    accessorFn: (row) => row.comment,
    cell: ({ row }) => <span className="truncate text-right">{row.original.comment ?? '-'}</span>,
    meta: { className: 'text-right' },
  },
  {
    header: 'Δ',
    accessorFn: (row) => row.delta,
    cell: ({ row }) => {
      const deltaText =
        row.original.delta > 0 ? `+${row.original.delta}` : String(row.original.delta)
      return <span className="text-right">{deltaText}</span>
    },
    meta: { className: 'text-right' },
  },
  {
    header: 'Было',
    accessorFn: (row) => row.balanceBefore,
    cell: ({ row }) => <span className="text-right">{row.original.balanceBefore}</span>,
    meta: { className: 'text-right' },
  },
  {
    header: 'Стало',
    accessorFn: (row) => row.balanceAfter,
    cell: ({ row }) => <span className="text-right">{row.original.balanceAfter}</span>,
    meta: { className: 'text-right' },
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <LessonsBalanceHistoryActions historyId={row.original.id} comment={row.original.comment} />
    ),
  },
]

function LessonsBalanceHistoryActions({
  historyId,
  comment,
}: {
  historyId: number
  comment: string | null
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newComment, setNewComment] = useState<string | null>(comment)
  const [isPending, startTransition] = useTransition()

  const handleCommentAdd = () => {
    if (!newComment) return
    startTransition(() => {
      const ok = updateStudentBalanceHistory({
        where: {
          id: historyId,
        },
        data: {
          comment: newComment,
        },
      })
      toast.promise(ok, {
        loading: 'Добавление комментария',
        success: 'Комментарий успешно добавлен',
        error: 'Ошибка при добавлении комментария',
        finally: () => {
          setDialogOpen(false)
        },
      })
    })
  }

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger render={<Button size={'icon'} variant={'ghost'} />}>
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent className={'w-max'}>
          <DropdownMenuItem
            onClick={() => {
              setDropdownOpen(false)
              setDialogOpen(true)
            }}
          >
            Оставить комментарий
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Комментарий</DialogTitle>
            <DialogDescription>Оставить комментарий к записи в истории</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel></FieldLabel>
              <Input
                value={newComment ?? ''}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="комментарий"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant={'outline'}>Отмена</Button>} />
            <Button onClick={handleCommentAdd} disabled={isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
