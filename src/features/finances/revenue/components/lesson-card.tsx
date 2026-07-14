import { Hint } from '@/src/components/hint'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/src/components/ui/collapsible'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/src/components/ui/table'
import { ymdToLocalDate } from '@/src/lib/timezone'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Users,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import type { LessonWithCost } from '../types'
import AttendanceRow from './attendance-row'

const STATUS_CONFIG = {
  ACTIVE: { label: 'Активный', variant: 'outline' as const, icon: CheckCircle2 },
  CANCELLED: { label: 'Отменён', variant: 'destructive' as const, icon: XCircle },
} as const

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: string) {
  return format(ymdToLocalDate(date), 'd MMMM', { locale: ru })
}

interface LessonCardProps {
  lesson: LessonWithCost
  allCardsOpen: boolean
}

export default function LessonCard({ lesson, allCardsOpen }: LessonCardProps) {
  const [isOpen, setIsOpen] = useState(allCardsOpen)
  const [prevAllCardsOpen, setPrevAllCardsOpen] = useState(allCardsOpen)
  if (prevAllCardsOpen !== allCardsOpen) {
    setPrevAllCardsOpen(allCardsOpen)
    setIsOpen(allCardsOpen)
  }

  const statusConfig = STATUS_CONFIG[lesson.status as keyof typeof STATUS_CONFIG]
  const StatusIcon = statusConfig?.icon ?? Clock
  const teachers = lesson.group.teachers.map((t) => t.teacher.name).join(', ')
  const lessonRevenue = lesson.attendance.reduce((s, a) => s + a.visitCost, 0)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="text-primary size-4 shrink-0" />
            <Link href={`/lessons/${lesson.id}`} className="text-primary truncate hover:underline">
              {lesson.group.course.name}
            </Link>
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDate(lesson.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {lesson.time}
            </span>
            {lesson.group.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {lesson.group.location.name}
              </span>
            )}
            {lesson.group.groupType && <span>{lesson.group.groupType.name}</span>}
            {teachers && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" />
                {teachers}
              </span>
            )}
            <Badge variant={statusConfig?.variant ?? 'outline'} className="shrink-0">
              <StatusIcon className="size-3" />
              {statusConfig?.label ?? lesson.status}
            </Badge>
          </CardDescription>
          <CardAction>
            <CollapsibleTrigger
              render={
                <Button size={'icon'} variant={'ghost'}>
                  {isOpen ? <ChevronUp /> : <ChevronDown />}
                </Button>
              }
            />
          </CardAction>
        </CardHeader>

        <CollapsibleContent>
          {lesson.attendance.length > 0 && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ученик</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">
                      <div className="inline-flex items-center gap-1">
                        Стоимость
                        <Hint text="Рассчитывается как Всего оплат / Всего уроков из кошелька ученика, привязанного к группе. Списывается при присутствии, неявке без предупреждения, или предупреждении с отработкой." />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lesson.attendance.map((att, idx) => (
                    <AttendanceRow key={idx} attendance={att} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </CollapsibleContent>
        <CardFooter>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground text-right text-xs">Итого за урок:</span>
            <span className="text-right text-xs font-semibold tabular-nums">
              {formatCurrency(lessonRevenue)}
            </span>
          </div>
        </CardFooter>
      </Card>
    </Collapsible>
  )
}
