'use client'

import { LessonStatus, Prisma } from '@/prisma/generated/client'
import { getLessons } from '@/src/actions/lessons'
import TableFilter, { TableFilterItem } from '@/src/components/table-filter'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Calendar } from '@/src/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/src/components/ui/collapsible'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Separator } from '@/src/components/ui/separator'
import { Skeleton } from '@/src/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip'
import { useMappedCourseListQuery } from '@/src/data/course/course-list-query'
import { useMappedLocationListQuery } from '@/src/data/location/location-list-query'
import { useMappedMemberListQuery } from '@/src/data/member/member-list-query'
import { useSessionQuery } from '@/src/data/user/session-query'
import { cn, getGroupName } from '@/src/lib/utils'
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import { ru } from 'date-fns/locale'
import {
  Ban,
  Banknote,
  BookOpen,
  Calendar as CalendarIcon,
  ChevronDown,
  Clock,
  FileText,
  GraduationCap,
  MapPin,
  Percent,
  Sparkles,
  TrendingUp,
  User,
  UserX,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'
import { DateRange } from 'react-day-picker'

// Типы данных
type LessonWithAttendance = Prisma.LessonGetPayload<{
  include: {
    attendance: { include: { student: { include: { groups: true } } } }
    group: { include: { course: true; location: true; groupType: true } }
    teachers: { include: { teacher: true } }
  }
}>

interface StudentRevenue {
  id: number
  name: string
  revenue: number
  isTrial: boolean
  isAbsent: boolean
}

interface LessonRevenue {
  id: number
  time: string | null
  groupId: number
  groupName: string
  groupTypeName: string | null
  locationName: string | null
  lessonStatus: LessonStatus
  revenue: number
  students: StudentRevenue[]
  studentCount: number
  paidCount: number
  presentCount: number
  absentCount: number
  trialCount: number
}

interface DayRevenue {
  date: Date
  dateKey: string
  revenue: number
  lessons: LessonRevenue[]
  totalStudents: number
  paidStudents: number
}

// Пресеты для быстрого выбора периода
const datePresets = [
  {
    label: 'Текущая неделя',
    getValue: () => ({
      from: startOfWeek(toZonedTime(new Date(), 'Europe/Moscow'), { weekStartsOn: 1 }),
      to: endOfWeek(toZonedTime(new Date(), 'Europe/Moscow'), { weekStartsOn: 1 }),
    }),
  },
  {
    label: 'Прошлая неделя',
    getValue: () => ({
      from: startOfWeek(subWeeks(toZonedTime(new Date(), 'Europe/Moscow'), 1), { weekStartsOn: 1 }),
      to: endOfWeek(subWeeks(toZonedTime(new Date(), 'Europe/Moscow'), 1), { weekStartsOn: 1 }),
    }),
  },
  {
    label: 'Текущий месяц',
    getValue: () => ({
      from: startOfMonth(toZonedTime(new Date(), 'Europe/Moscow')),
      to: endOfMonth(toZonedTime(new Date(), 'Europe/Moscow')),
    }),
  },
  {
    label: 'Прошлый месяц',
    getValue: () => ({
      from: startOfMonth(subMonths(toZonedTime(new Date(), 'Europe/Moscow'), 1)),
      to: endOfMonth(subMonths(toZonedTime(new Date(), 'Europe/Moscow'), 1)),
    }),
  },
]

// Функция расчета выручки по ученику в конкретной группе
function calculateStudentRevenue(
  student: {
    groups: { groupId: number; totalLessons: number; totalPayments: number }[]
  },
  groupId: number
): number {
  const group = student.groups.find((g) => g.groupId === groupId)
  if (!group || group.totalLessons === 0) return 0
  return group.totalPayments / group.totalLessons
}

// Трансформация уроков в данные выручки
function transformLessonsToRevenueData(lessons: LessonWithAttendance[]): DayRevenue[] {
  const groupedByDate: Record<string, LessonWithAttendance[]> = {}

  for (const lesson of lessons) {
    const dateKey = formatInTimeZone(lesson.date, 'Europe/Moscow', 'yyyy-MM-dd')
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = []
    groupedByDate[dateKey].push(lesson)
  }

  return Object.entries(groupedByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dayLessons]) => {
      const lessonRevenues: LessonRevenue[] = dayLessons.map((lesson) => {
        const students: StudentRevenue[] = lesson.attendance.map((att) => ({
          id: att.student.id,
          name: `${att.student.firstName} ${att.student.lastName ?? ''}`.trim(),
          revenue:
            att.studentStatus !== 'TRIAL' && att.status === 'PRESENT'
              ? calculateStudentRevenue(att.student, lesson.group.id)
              : 0,
          isTrial: att.studentStatus === 'TRIAL',
          isAbsent: att.status === 'ABSENT',
        }))

        const paidStudents = students.filter((s) => !s.isTrial)
        const presentStudents = students.filter((s) => !s.isAbsent)
        const absentStudents = students.filter((s) => s.isAbsent)
        const trialStudents = students.filter((s) => s.isTrial)

        return {
          id: lesson.id,
          time: lesson.time,
          lessonStatus: lesson.status,
          groupId: lesson.group.id,
          groupName: getGroupName(lesson.group),
          groupTypeName: lesson.group.groupType?.name || null,
          locationName: lesson.group.location?.name || null,
          revenue: Math.floor(
            paidStudents.filter((s) => !s.isAbsent).reduce((sum, s) => sum + s.revenue, 0)
          ),
          students,
          studentCount: students.length,
          paidCount: paidStudents.length,
          presentCount: presentStudents.length,
          absentCount: absentStudents.length,
          trialCount: trialStudents.length,
        }
      })

      const dayRevenue = lessonRevenues.reduce((sum, l) => sum + l.revenue, 0)
      const totalStudents = lessonRevenues.reduce((sum, l) => sum + l.studentCount, 0)
      const paidStudents = lessonRevenues.reduce((sum, l) => sum + l.paidCount, 0)

      return {
        date: new Date(dateKey),
        dateKey,
        revenue: dayRevenue,
        lessons: lessonRevenues,
        totalStudents,
        paidStudents,
      }
    })
}

export default function RevenueClient() {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const organizationId = session?.organizationId ?? undefined
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [selectedLocations, setSelectedLocations] = useState<TableFilterItem[]>([])
  const [selectedCourses, setSelectedCourses] = useState<TableFilterItem[]>([])
  const [selectedTeachers, setSelectedTeachers] = useState<TableFilterItem[]>([])
  const [isPending, startTransition] = useTransition()

  const [lessons, setLessons] = useState<LessonWithAttendance[]>([])

  const fetchData = useCallback(async () => {
    if (dateRange?.from && dateRange?.to) {
      const from = fromZonedTime(dateRange.from, 'Europe/Moscow')
      const to = fromZonedTime(dateRange.to, 'Europe/Moscow')

      const groupFilter: { courseId?: object; locationId?: object } = {}
      if (selectedCourses.length > 0) {
        groupFilter.courseId = { in: selectedCourses.map((c) => +c.value) }
      }
      if (selectedLocations.length > 0) {
        groupFilter.locationId = { in: selectedLocations.map((l) => +l.value) }
      }

      // Фильтр по преподавателям
      const teacherFilter =
        selectedTeachers.length > 0
          ? { some: { teacherId: { in: selectedTeachers.map((t) => +t.value) } } }
          : undefined

      const lessonsData = await getLessons({
        where: {
          organizationId,
          date: { gte: from, lte: to },
          group: Object.keys(groupFilter).length > 0 ? groupFilter : undefined,
          teachers: teacherFilter,
        },
        include: {
          attendance: {
            include: { student: { include: { groups: true } } },
          },
          group: { include: { course: true, location: true, groupType: true } },
          teachers: { include: { teacher: true } },
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      })
      setLessons(lessonsData)
    } else {
      setLessons([])
    }
  }, [dateRange, selectedCourses, selectedLocations, selectedTeachers, organizationId])

  useEffect(() => {
    startTransition(() => {
      fetchData()
    })
  }, [fetchData, organizationId])

  // Трансформированные данные
  const revenueData = useMemo(() => transformLessonsToRevenueData(lessons), [lessons])

  // Сводная статистика
  const stats = useMemo(() => {
    const totalRevenue = revenueData.reduce((sum, day) => sum + day.revenue, 0)
    const totalLessons = revenueData.reduce((sum, day) => sum + day.lessons.length, 0)
    const totalStudentLessons = revenueData.reduce((sum, day) => sum + day.totalStudents, 0)
    const paidStudentLessons = revenueData.reduce((sum, day) => sum + day.paidStudents, 0)
    const paymentRate = totalStudentLessons > 0 ? paidStudentLessons / totalStudentLessons : 0
    const avgPerLesson = totalLessons > 0 ? Math.round(totalRevenue / totalLessons) : 0
    const avgPerStudent = paidStudentLessons > 0 ? Math.round(totalRevenue / paidStudentLessons) : 0

    return {
      totalRevenue,
      totalLessons,
      totalStudentLessons,
      paidStudentLessons,
      paymentRate,
      avgPerLesson,
      avgPerStudent,
      daysCount: revenueData.length,
    }
  }, [revenueData])

  const handlePresetSelect = (preset: (typeof datePresets)[0]) => {
    setDateRange(preset.getValue())
    setIsCalendarOpen(false)
  }

  const formatDateRange = () => {
    if (!dateRange?.from) return 'Выберите период'
    if (!dateRange.to) return format(dateRange.from, 'd MMM yyyy', { locale: ru })
    return `${format(dateRange.from, 'd MMM', { locale: ru })} – ${format(dateRange.to, 'd MMM yyyy', { locale: ru })}`
  }

  if (isSessionLoading) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <div className="space-y-2">
      {/* Панель управления */}
      <Card>
        <CardContent>
          <div className="flex flex-col items-end gap-2 lg:flex-row lg:justify-between">
            {/* Выбор периода */}
            <div className="flex items-center gap-2">
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger
                  render={
                    <Button variant="outline" className="min-w-50 justify-start gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span className="truncate">{formatDateRange()}</span>
                      <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex">
                    {/* Пресеты */}
                    <div className="border-r p-2">
                      <div className="text-muted-foreground mb-2 px-2 text-xs font-medium">
                        Быстрый выбор
                      </div>
                      <div className="flex flex-col gap-1">
                        {datePresets.map((preset) => (
                          <Button
                            key={preset.label}
                            variant="ghost"
                            size="sm"
                            className="justify-start text-xs"
                            onClick={() => handlePresetSelect(preset)}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {/* Календарь */}
                    <Calendar
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      locale={ru}
                      numberOfMonths={2}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              {dateRange && (
                <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Filters
              organizationId={organizationId!}
              onCoursesChange={setSelectedCourses}
              onLocationsChange={setSelectedLocations}
              onTeachersChange={setSelectedTeachers}
            />
          </div>
        </CardContent>
      </Card>

      {/* Статистика */}
      {dateRange?.from && dateRange?.to && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Общая выручка"
            value={`${stats.totalRevenue.toLocaleString()} ₽`}
            icon={<Banknote className="h-4 w-4" />}
            description={`за ${stats.daysCount} дн.`}
            loading={isPending}
          />
          <StatCard
            title="Ученикоуроков"
            value={stats.totalStudentLessons.toString()}
            icon={<GraduationCap className="h-4 w-4" />}
            description={`${stats.totalLessons} уроков`}
            loading={isPending}
          />
          <StatCard
            title="Оплачено"
            value={`${Math.round(stats.paymentRate * 100)}%`}
            icon={<Percent className="h-4 w-4" />}
            description={`${stats.paidStudentLessons} из ${stats.totalStudentLessons}`}
            loading={isPending}
          />
          <StatCard
            title="Средняя выручка"
            value={`${stats.avgPerStudent.toLocaleString()} ₽`}
            icon={<TrendingUp className="h-4 w-4" />}
            description="за ученикоурок"
            loading={isPending}
          />
        </div>
      )}

      {/* Контент */}
      {!dateRange?.from || !dateRange?.to ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarIcon className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">Выберите период</h3>
            <p className="text-muted-foreground text-center text-sm">
              Используйте календарь или быстрые пресеты для выбора периода отображения выручки
            </p>
          </CardContent>
        </Card>
      ) : isPending ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-1/3" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : revenueData.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">Нет данных</h3>
            <p className="text-muted-foreground text-center text-sm">
              За выбранный период уроки с присутствующими учениками не найдены
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {revenueData.map((day) => (
            <DayCard key={day.dateKey} data={day} />
          ))}
        </div>
      )}
    </div>
  )
}

interface FiltersProps {
  organizationId: number
  onCoursesChange: Dispatch<SetStateAction<TableFilterItem[]>>
  onLocationsChange: Dispatch<SetStateAction<TableFilterItem[]>>
  onTeachersChange: Dispatch<SetStateAction<TableFilterItem[]>>
}
function Filters({
  organizationId,
  onCoursesChange,
  onLocationsChange,
  onTeachersChange,
}: FiltersProps) {
  const { data: courses, isLoading: isCoursesLoading } = useMappedCourseListQuery(organizationId)
  const { data: locations, isLoading: isLocationsLoading } =
    useMappedLocationListQuery(organizationId)
  const { data: mappedUsers, isLoading: isMembersLoading } =
    useMappedMemberListQuery(organizationId)

  if (isCoursesLoading || isLocationsLoading || isMembersLoading) {
    return (
      <>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </>
    )
  }

  return (
    <>
      {courses ? (
        <TableFilter label="Курс" items={courses} onChange={onCoursesChange} />
      ) : (
        <Skeleton className="h-8 w-full" />
      )}
      {locations ? (
        <TableFilter label="Локация" items={locations} onChange={onLocationsChange} />
      ) : (
        <Skeleton className="h-8 w-full" />
      )}
      {mappedUsers ? (
        <TableFilter label="Преподаватель" items={mappedUsers} onChange={onTeachersChange} />
      ) : (
        <Skeleton className="h-8 w-full" />
      )}
    </>
  )
}

// Компонент карточки статистики
interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  description: string
  loading?: boolean
}

function StatCard({ title, value, icon, description, loading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="mb-1 h-7 w-24" />
            <Skeleton className="h-4 w-16" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-muted-foreground text-xs">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Компонент карточки дня
interface DayCardProps {
  data: DayRevenue
}

function DayCard({ data }: DayCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="transition-shadow hover:shadow-md">
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="text-base">
                    {formatInTimeZone(data.date, 'Europe/Moscow', 'd MMMM, EEEE', { locale: ru })}
                  </CardTitle>
                  <p className="text-muted-foreground text-xs">
                    {data.lessons.length} урок(ов) • {data.totalStudents} ученик(ов)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xl font-bold">
                    {data.revenue > 0 ? (
                      <span className="text-success">{data.revenue.toLocaleString()} ₽</span>
                    ) : (
                      <span className="text-muted-foreground">0 ₽</span>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    'text-muted-foreground h-5 w-5 transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator />
          <CardContent className="space-y-3 pt-4">
            {data.lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// Компонент карточки урока
interface LessonCardProps {
  lesson: LessonRevenue
}

function LessonCard({ lesson }: LessonCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isCancelled = lesson.lessonStatus === 'CANCELLED'

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'hover:bg-muted/30 rounded-lg border transition-colors',
          isCancelled && 'border-destructive/30 bg-destructive/5'
        )}
      >
        <CollapsibleTrigger className="w-full p-3 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {isCancelled ? (
                  <Ban className="text-destructive h-4 w-4 shrink-0" />
                ) : (
                  <BookOpen className="text-muted-foreground h-4 w-4 shrink-0" />
                )}
                <Link
                  href={`/dashboard/groups/${lesson.groupId}`}
                  className={cn(
                    'truncate font-medium hover:underline',
                    isCancelled ? 'text-destructive line-through' : 'text-primary'
                  )}
                >
                  {lesson.groupName}
                </Link>
                {isCancelled && (
                  <Badge variant="destructive" className="text-xs">
                    Отменен
                  </Badge>
                )}
                {lesson.groupTypeName && !isCancelled && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Badge variant="outline" className="gap-1">
                          <FileText className="h-3 w-3" />
                          {lesson.groupTypeName}
                        </Badge>
                      }
                    />
                    <TooltipContent>Тип занятия</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {lesson.time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {lesson.time}
                  </span>
                )}
                {lesson.locationName && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {lesson.locationName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {lesson.presentCount}/{lesson.studentCount} присут.
                </span>
                {lesson.trialCount > 0 && (
                  <span className="text-info flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {lesson.trialCount} пробн.
                  </span>
                )}
                {lesson.absentCount > 0 && (
                  <span className="text-warning flex items-center gap-1">
                    <UserX className="h-3 w-3" />
                    {lesson.absentCount} пропуск(ов)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold whitespace-nowrap">
                {isCancelled ? (
                  <span className="text-destructive line-through">0 ₽</span>
                ) : lesson.revenue > 0 ? (
                  <span className="text-success">{lesson.revenue.toLocaleString()} ₽</span>
                ) : (
                  <span className="text-muted-foreground">0 ₽</span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  'text-muted-foreground h-4 w-4 transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-3 pb-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">Ученик</TableHead>
                  <TableHead className="h-8 text-right text-xs">Статус</TableHead>
                  <TableHead className="h-8 text-right text-xs">Выручка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lesson.students.map((student) => (
                  <TableRow
                    key={student.id}
                    className={cn(
                      student.isAbsent && 'bg-warning/5',
                      student.isTrial && !student.isAbsent && 'bg-info/5'
                    )}
                  >
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        {student.isTrial ? (
                          <Sparkles className="text-info h-3 w-3" />
                        ) : student.isAbsent ? (
                          <UserX className="text-warning h-3 w-3" />
                        ) : (
                          <User className="text-muted-foreground h-3 w-3" />
                        )}
                        <span
                          className={cn(
                            student.isTrial && 'text-info font-medium',
                            student.isAbsent && !student.isTrial && 'text-warning'
                          )}
                        >
                          {student.name}
                        </span>
                        {student.isTrial && (
                          <Badge className="bg-info/10 text-info border-info/30 text-xs">
                            Пробный
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      {student.isAbsent ? (
                        <Badge variant="outline" className="border-warning/50 text-warning text-xs">
                          Пропуск
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-success/50 text-success text-xs">
                          Присут.
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      {student.isAbsent ? (
                        <span className="text-muted-foreground">-</span>
                      ) : student.revenue > 0 ? (
                        <span className="text-success font-medium">
                          {Math.floor(student.revenue).toLocaleString()} ₽
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
