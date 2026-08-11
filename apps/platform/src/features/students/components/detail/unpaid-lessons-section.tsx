'use client'

import { Badge } from '@repo/ui/components/badge'
import { Hint } from '@repo/ui/components/hint'
import { Skeleton } from '@repo/ui/components/skeleton'
import { formatDateOnly } from '@/src/lib/timezone'
import { CircleAlert } from 'lucide-react'
import Link from 'next/link'
import { useStudentUnpaidLessonsQuery } from '../../queries'

/**
 * Занятия, которые школа провела, а оплаты под них не было.
 *
 * Суммы здесь намеренно нет: цена появится вместе с оплатой — она эти занятия и
 * закроет, по своей цене. До тех пор известно только их количество и даты.
 */
export default function UnpaidLessonsSection({ studentId }: { studentId: number }) {
  const { data, isPending } = useStudentUnpaidLessonsQuery(studentId)

  if (isPending) return <Skeleton className="h-24 w-full rounded-xl" />
  if (!data || data.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <CircleAlert size={20} />
        Ждут оплаты
        <Hint text="Занятия проведены, но оплаты под них не нашлось. Следующая оплата закроет их по своей цене, от самого раннего." />
      </h3>

      <div className="rounded-xl border">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Badge variant="destructive">{data.length}</Badge>
          <span className="text-sm">
            {data.length === 1 ? 'занятие ждёт оплаты' : 'занятий ждут оплаты'}
          </span>
          <span className="text-muted-foreground text-sm">· с {formatDateOnly(data[0]!.date)}</span>
        </div>

        <ul className="divide-y">
          {data.map((lesson) => (
            <li
              key={lesson.attendanceId}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
            >
              <span className="tabular-nums">
                {formatDateOnly(lesson.date)} · {lesson.time}
              </span>
              <Link
                href={`/groups/${lesson.groupId}`}
                className="text-muted-foreground hover:text-foreground truncate"
              >
                {lesson.groupName}
              </Link>
              <Badge variant="outline">
                {lesson.status === 'PRESENT' ? 'Был' : 'Пропуск без предупреждения'}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
