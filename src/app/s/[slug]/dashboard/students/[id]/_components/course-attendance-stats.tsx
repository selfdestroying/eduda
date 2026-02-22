import { Badge } from '@/src/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip'
import { StudentWithGroupsAndAttendance } from '@/src/types/student'
import { BarChart3, CheckCircle2, Info, RefreshCw, XCircle } from 'lucide-react'

interface CourseStats {
  courseName: string
  totalLessons: number
  attended: number
  madeUp: number
  missed: number
}

function computeCourseStats(student: StudentWithGroupsAndAttendance): CourseStats[] {
  const courseStats = new Map<number, CourseStats>()
  // Считаем totalLessons из текущих групп
  const countedGroupIds = new Set<number>()
  const currentGroupIds = new Set<number>()

  for (const sg of student.groups) {
    const group = sg.group
    const courseId = group.course.id
    countedGroupIds.add(group.id)
    currentGroupIds.add(group.id)

    const existing = courseStats.get(courseId) || {
      courseName: group.course.name,
      totalLessons: 0,
      attended: 0,
      madeUp: 0,
      missed: 0,
    }
    existing.totalLessons += group.lessons.length
    courseStats.set(courseId, existing)
  }

  // Обрабатываем все посещения (включая старые группы)
  // Отработки в чужих группах полностью пропускаем - они не влияют на статистику
  for (const attendance of student.attendances) {
    const group = attendance.lesson.group
    const isMakeup = !!attendance.asMakeupFor

    // Отработка в группе, где ученик не состоит - пропускаем полностью
    if (isMakeup && !countedGroupIds.has(group.id) && !currentGroupIds.has(group.id)) {
      continue
    }

    const courseId = group.course.id
    const courseName = group.course.name

    if (!courseStats.has(courseId)) {
      courseStats.set(courseId, {
        courseName,
        totalLessons: 0,
        attended: 0,
        madeUp: 0,
        missed: 0,
      })
    }

    const stats = courseStats.get(courseId)!

    // Если группа не среди текущих и это не отработка - считаем уроки из посещений
    if (!countedGroupIds.has(group.id) && !isMakeup) {
      countedGroupIds.add(group.id)
      const lessonsInGroup = student.attendances.filter(
        (a) => a.lesson.groupId === group.id && !a.asMakeupFor
      ).length
      stats.totalLessons += lessonsInGroup
    }

    if (attendance.status === 'PRESENT') {
      stats.attended++
    } else if (attendance.status === 'ABSENT') {
      stats.missed++
      if (attendance.missedMakeup) {
        if (attendance.missedMakeup.makeUpAttendance.status === 'PRESENT') {
          stats.madeUp++
        }
      }
    }
  }

  return Array.from(courseStats.values())
}

export default function CourseAttendanceStats({
  student,
}: {
  student: StudentWithGroupsAndAttendance
}) {
  const stats = computeCourseStats(student)

  if (stats.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
          <BarChart3 size={20} />
          Статистика посещаемости
        </h3>
        <p className="text-muted-foreground">Нет данных о посещаемости.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <BarChart3 size={20} />
        Статистика посещаемости
        <Tooltip>
          <TooltipTrigger className="text-warning cursor-help">
            <Info size={16} />
          </TooltipTrigger>
          <TooltipContent>
            Раздел в режиме тестирования. Статистика включает данные из всех групп ученика (текущих
            и прошлых) и может отображаться некорректно.
          </TooltipContent>
        </Tooltip>
      </h3>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((course) => {
          const attendanceRate =
            course.totalLessons > 0
              ? Math.round(((course.attended + course.madeUp) / course.totalLessons) * 100)
              : 0

          return (
            <div
              key={course.courseName}
              className="bg-muted/50 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="truncate text-sm font-medium">{course.courseName}</span>
                <Badge
                  variant={attendanceRate >= 80 ? 'default' : 'destructive'}
                  className="shrink-0 px-1.5 py-0 text-[10px]"
                >
                  {attendanceRate}%
                </Badge>
              </div>
              <div className="text-muted-foreground flex shrink-0 items-center gap-2.5 text-xs">
                <span className="flex items-center gap-0.5" title="Посещено">
                  <CheckCircle2 size={12} className="text-green-500" />
                  {course.attended}
                </span>
                <span className="flex items-center gap-0.5" title="Отработано">
                  <RefreshCw size={12} className="text-blue-500" />
                  {course.madeUp}
                </span>
                <span className="flex items-center gap-0.5" title="Пропущено">
                  <XCircle size={12} className="text-red-500" />
                  {course.missed}
                </span>
                <span className="text-foreground font-medium" title="Всего занятий">
                  {course.totalLessons}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
