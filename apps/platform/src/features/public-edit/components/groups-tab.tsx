'use client'

import { Badge } from '@/src/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/src/components/ui/popover'
import { Separator } from '@/src/components/ui/separator'
import { Skeleton } from '@/src/components/ui/skeleton'
import { formatDateOnly } from '@/src/lib/timezone'
import { cn, getGroupName } from '@/src/lib/utils'
import { AlertTriangle, CheckCircle2, MapPin, Minus, XCircle } from 'lucide-react'
import { usePublicStudentGroupsQuery } from '../queries'

type GroupsData = NonNullable<
  Awaited<ReturnType<(typeof import('../actions'))['getPublicStudentGroups']>>['data']
>

type StudentGroupItem = GroupsData[number]

type LessonItem = StudentGroupItem['group']['lessons'][number]

const STUDENT_STATUS: Record<
  string,
  { label: string; variant: 'secondary' | 'success' | 'destructive' | 'outline' } | null
> = {
  ACTIVE: null,
  TRIAL: { label: 'Пробный', variant: 'secondary' },
  DISMISSED: { label: 'Отчислен', variant: 'destructive' },
  TRANSFERRED: { label: 'Переведён', variant: 'outline' },
  COMPLETED: { label: 'Завершил', variant: 'success' },
}

type Attendance = NonNullable<ReturnType<typeof getLessonAttendance>>

const STATUS_LABEL = {
  PRESENT: { label: 'Присутствовал', icon: CheckCircle2, class: 'text-success' },
  ABSENT: { label: 'Отсутствовал', icon: XCircle, class: 'text-destructive' },
  UNSPECIFIED: { label: 'Не отмечен', icon: Minus, class: 'text-muted-foreground' },
} as const

function getLessonAttendance(lesson: LessonItem) {
  return lesson.attendance[0] ?? null
}

function chipClass(att: Attendance | null) {
  if (!att || att.status === 'UNSPECIFIED') return 'bg-muted/40 text-muted-foreground'
  if (att.status === 'PRESENT') return 'bg-success/20 text-success'
  // ABSENT
  if (att.isWarned) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  return 'bg-destructive/20 text-destructive'
}

// Списывается ли занятие с баланса (зеркало isLessonCharged из lib/lessons-balance).
function isCharged(att: Attendance | null) {
  if (!att) return false
  if (att.status === 'PRESENT') return true
  if (att.status === 'ABSENT' && !att.isWarned) return true
  return false
}

export default function GroupsTab({ token, studentId }: { token: string; studentId: number }) {
  const { data, isPending, isError } = usePublicStudentGroupsQuery(token, studentId)

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Не удалось загрузить группы. Попробуйте обновить страницу.
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Ребёнок пока не состоит в группах.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((sg) => {
        const lessons = sg.group.lessons
        const present = lessons.filter((l) => getLessonAttendance(l)?.status === 'PRESENT').length
        const absent = lessons.filter((l) => getLessonAttendance(l)?.status === 'ABSENT').length
        const unspecified = lessons.length - present - absent
        const statusBadge = STUDENT_STATUS[sg.status] ?? null

        return (
          <Card
            key={sg.group.id}
            className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20"
          >
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {getGroupName(sg.group)}
                {statusBadge && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {sg.group.location.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-success">Посещено: {present}</span>
                <span className="text-destructive">Пропущено: {absent}</span>
                <span className="text-muted-foreground">Без отметки: {unspecified}</span>
              </div>

              {lessons.length === 0 ? (
                <p className="text-muted-foreground text-xs">Занятий пока нет.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {lessons.map((lesson) => {
                    const att = getLessonAttendance(lesson)
                    const status = att?.status ?? 'UNSPECIFIED'
                    const config = STATUS_LABEL[status]
                    const StatusIcon = config.icon
                    return (
                      <Popover key={lesson.id}>
                        <PopoverTrigger
                          className={cn(
                            'cursor-pointer rounded-md px-2 py-0.5 text-xs tabular-nums',
                            chipClass(att),
                          )}
                        >
                          {formatDateOnly(lesson.date, { day: '2-digit', month: '2-digit' })}
                        </PopoverTrigger>
                        <PopoverContent className="gap-2.5" align="center">
                          <PopoverHeader>
                            <PopoverTitle className="flex items-center gap-2">
                              <StatusIcon className={cn('size-4', config.class)} />
                              <span className={config.class}>{config.label}</span>
                            </PopoverTitle>
                            <PopoverDescription>
                              {formatDateOnly(lesson.date, {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                              {lesson.time ? `, ${lesson.time}` : ''}
                            </PopoverDescription>
                          </PopoverHeader>

                          {(att?.isTrial || att?.isWarned) && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {att?.isTrial && <Badge variant="secondary">Пробное</Badge>}
                              {att?.isWarned && (
                                <Badge
                                  variant="secondary"
                                  className="bg-amber-500/10 text-amber-600 outline-none dark:text-amber-400"
                                >
                                  <AlertTriangle data-icon="inline-start" />
                                  Предупредил
                                </Badge>
                              )}
                            </div>
                          )}

                          <Separator />

                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Списано занятие</span>
                            <span className="font-medium">{isCharged(att) ? 'Да' : 'Нет'}</span>
                          </div>

                          {att?.comment && (
                            <>
                              <Separator />
                              <p className="text-muted-foreground">{att.comment}</p>
                            </>
                          )}
                        </PopoverContent>
                      </Popover>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
