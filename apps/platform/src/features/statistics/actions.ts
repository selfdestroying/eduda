'use server'

import { prisma } from '@repo/db'
import { authAction } from '@/src/lib/safe-action'
import { nowInTz, toTz } from '@/src/lib/timezone'

// ─── ACTIVE STATISTICS ───────────────────────────────────────────────────────

export const getActiveStudentStatistics = authAction
  .metadata({ actionName: 'getActiveStudentStatistics' })
  .action(async ({ ctx }) => {
    const organizationId = ctx.session.organizationId!

    const activeStudentGroups = await prisma.studentGroup.findMany({
      where: { organizationId, status: { in: ['ACTIVE', 'TRIAL'] } },
      include: {
        group: {
          include: {
            course: true,
            location: true,
            teachers: {
              include: {
                teacher: true,
              },
            },
          },
        },
        student: true,
      },
      orderBy: {
        student: {
          createdAt: 'asc',
        },
      },
    })

    const uniqueStudentsMap = new Map<number, (typeof activeStudentGroups)[0]['student']>()
    activeStudentGroups.forEach((sg) => {
      uniqueStudentsMap.set(sg.student.id, sg.student)
    })

    const totalStudents = uniqueStudentsMap.size

    // Набор считаем по всем заведённым ученикам, а не по сегодня активным. Иначе
    // мартовский столбец уменьшается каждый раз, когда кто-то уходит: прошлое
    // переписывается задним числом, и по нему нельзя принимать решения.
    // Ученик, заведённый и не попавший ни в одну группу, тоже идёт в набор —
    // у Student статуса нет, он живёт на StudentGroup.
    const enrolledStudents = await prisma.student.findMany({
      where: { organizationId },
      select: { createdAt: true },
    })

    const monthlyStatsMap = new Map<string, { count: number; timestamp: number }>()
    enrolledStudents.forEach((student) => {
      const date = toTz(student.createdAt, ctx.tz)
      const y = date.getFullYear()
      const m = date.getMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      const existing = monthlyStatsMap.get(key)
      if (existing) {
        existing.count++
      } else {
        monthlyStatsMap.set(key, { count: 1, timestamp: new Date(y, m, 1).getTime() })
      }
    })

    const monthly = Array.from(monthlyStatsMap.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([, val]) => {
        const d = new Date(val.timestamp)
        return {
          month: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
          count: val.count,
        }
      })

    const now = nowInTz(ctx.tz)
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    const newThisMonth = monthlyStatsMap.get(thisMonthKey)?.count ?? 0
    const newPrevMonth = monthlyStatsMap.get(prevMonthKey)?.count ?? 0
    const growthPercent =
      newPrevMonth > 0 ? Math.round(((newThisMonth - newPrevMonth) / newPrevMonth) * 100) : 0

    const locationStats: Record<string, Set<number>> = {}
    activeStudentGroups.forEach((sg) => {
      const locName = sg.group.location?.name || 'Не указано'
      if (!locationStats[locName]) locationStats[locName] = new Set()
      locationStats[locName].add(sg.studentId)
    })
    const locations = Object.entries(locationStats)
      .map(([name, s]) => ({ name, count: s.size }))
      .sort((a, b) => b.count - a.count)

    const teacherStats: Record<string, Set<number>> = {}
    activeStudentGroups.forEach((sg) => {
      sg.group.teachers.forEach((tg) => {
        const teacherName = tg.teacher.name
        if (!teacherStats[teacherName]) teacherStats[teacherName] = new Set()
        teacherStats[teacherName].add(sg.studentId)
      })
    })
    const teachers = Object.entries(teacherStats)
      .map(([name, s]) => ({ name, count: s.size }))
      .sort((a, b) => b.count - a.count)

    const courseStats: Record<string, Set<number>> = {}
    activeStudentGroups.forEach((sg) => {
      const courseName = sg.group.course.name
      if (!courseStats[courseName]) courseStats[courseName] = new Set()
      courseStats[courseName].add(sg.studentId)
    })
    const courses = Object.entries(courseStats)
      .map(([name, s]) => ({ name, count: s.size }))
      .sort((a, b) => b.count - a.count)

    const totalGroups = new Set(activeStudentGroups.map((sg) => sg.groupId)).size
    const avgPerGroup = totalGroups > 0 ? Math.round((totalStudents / totalGroups) * 10) / 10 : 0

    // Сколько учеников занималось в каждом месяце. Считаем по фактическим урокам:
    // истории статусов в БД нет — у StudentGroup только текущий статус и дата
    // последней смены, журнала переходов нет нигде, — так что посещаемость
    // единственный источник с полными данными за прошлое. Ученик засчитан в месяц,
    // если у него был хотя бы один урок; отметка не важна (отсутствие на занятии не
    // значит, что человек перестал быть учеником), а отменённые уроки не в счёт.
    // ponytail: вся посещаемость организации читается в память — десятки тысяч строк
    // на школе в пару сотен учеников. Начнёт тормозить — здесь нужен GROUP BY по
    // substring(date, 1, 7) сырым SQL, но $queryRaw в проекте пока нигде нет.
    const attendedLessons = await prisma.attendance.findMany({
      where: { organizationId, lesson: { status: { not: 'CANCELLED' } } },
      select: { studentId: true, lesson: { select: { date: true } } },
    })

    const studentsByMonth = new Map<string, Set<number>>()
    for (const a of attendedLessons) {
      // Lesson.date — строка `YYYY-MM-DD`, месяц это её префикс.
      const key = a.lesson.date.slice(0, 7)
      const bucket = studentsByMonth.get(key)
      if (bucket) bucket.add(a.studentId)
      else studentsByMonth.set(key, new Set([a.studentId]))
    }

    // Месяцы без уроков рисуем нулём, а не пропускаем: летний провал — это факт,
    // и на склеенном ряде его не видно.
    const studiedKeys = Array.from(studentsByMonth.keys()).sort()
    const firstKey = studiedKeys[0]
    const lastKey = studiedKeys[studiedKeys.length - 1]
    const studiedMonthly: { month: string; count: number }[] = []
    if (firstKey && lastKey) {
      const cursor = new Date(Number(firstKey.slice(0, 4)), Number(firstKey.slice(5, 7)) - 1, 1)
      const end = new Date(Number(lastKey.slice(0, 4)), Number(lastKey.slice(5, 7)) - 1, 1)
      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
        studiedMonthly.push({
          month: cursor.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
          count: studentsByMonth.get(key)?.size ?? 0,
        })
        cursor.setMonth(cursor.getMonth() + 1)
      }
    }

    return {
      totalStudents,
      newThisMonth,
      newPrevMonth,
      growthPercent,
      totalGroups,
      avgPerGroup,
      monthly,
      studiedMonthly,
      locations,
      teachers,
      courses,
    }
  })

// ─── DISMISSED STATISTICS ────────────────────────────────────────────────────

export const getDismissedStatistics = authAction
  .metadata({ actionName: 'getDismissedStatistics' })
  .action(async ({ ctx }) => {
    const organizationId = ctx.session.organizationId!

    const [dismissed, allGroups, activeCount] = await Promise.all([
      prisma.studentGroup.findMany({
        where: { organizationId, status: 'DISMISSED' },
        include: {
          group: {
            include: {
              course: true,
              location: true,
              teachers: { include: { teacher: true } },
            },
          },
          student: true,
        },
        orderBy: { statusChangedAt: 'asc' },
      }),
      prisma.teacherGroup.findMany({
        where: { organizationId },
        include: {
          group: {
            select: {
              _count: { select: { students: { where: { status: { in: ['ACTIVE', 'TRIAL'] } } } } },
            },
          },
          teacher: true,
        },
        orderBy: { teacher: { id: 'asc' } },
      }),
      prisma.studentGroup.count({ where: { organizationId, status: { in: ['ACTIVE', 'TRIAL'] } } }),
    ])

    const totalDismissed = dismissed.length
    const churnRate =
      activeCount + totalDismissed > 0
        ? Math.round((totalDismissed / (activeCount + totalDismissed)) * 1000) / 10
        : 0

    const monthlyStatsMap = new Map<string, { count: number; timestamp: number }>()
    dismissed.forEach((item) => {
      const date = item.statusChangedAt ? new Date(item.statusChangedAt) : new Date(item.updatedAt)
      const y = date.getUTCFullYear()
      const m = date.getUTCMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      const existing = monthlyStatsMap.get(key)
      if (existing) {
        existing.count++
      } else {
        monthlyStatsMap.set(key, { count: 1, timestamp: Date.UTC(y, m, 1) })
      }
    })

    const monthly = Array.from(monthlyStatsMap.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([, val]) => {
        const d = new Date(val.timestamp)
        return {
          month: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
          count: val.count,
        }
      })

    const now = nowInTz(ctx.tz)
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    const thisMonthCount = monthlyStatsMap.get(thisMonthKey)?.count ?? 0
    const prevMonthCount = monthlyStatsMap.get(prevMonthKey)?.count ?? 0

    const teacherStudentCounts: Record<string, number> = {}
    allGroups.forEach((tg) => {
      const name = tg.teacher.name
      teacherStudentCounts[name] = (teacherStudentCounts[name] || 0) + tg.group._count.students
    })

    const dismissedByTeacher: Record<string, number> = {}
    dismissed.forEach((item) => {
      item.group.teachers.forEach((tg) => {
        const name = tg.teacher.name
        dismissedByTeacher[name] = (dismissedByTeacher[name] || 0) + 1
      })
    })

    const teachers = Object.entries(dismissedByTeacher)
      .map(([teacherName, count]) => {
        const totalStudents = teacherStudentCounts[teacherName] || 0
        const percentage = totalStudents > 0 ? (count / (totalStudents + count)) * 100 : 0
        return {
          teacherName,
          dismissedCount: count,
          totalStudents,
          percentage: Math.round(percentage * 100) / 100,
        }
      })
      .sort((a, b) => b.percentage - a.percentage)

    const courseStats = dismissed.reduce(
      (acc, item) => {
        const name = item.group.course.name
        acc[name] = (acc[name] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const locationStats = dismissed.reduce(
      (acc, item) => {
        const name = item.group.location?.name || 'Не указано'
        acc[name] = (acc[name] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const topCourse = Object.entries(courseStats).sort((a, b) => b[1] - a[1])[0]

    return {
      totalDismissed,
      churnRate,
      thisMonthCount,
      prevMonthCount,
      topCourseName: topCourse?.[0] ?? '-',
      topCourseCount: topCourse?.[1] ?? 0,
      monthly,
      teachers,
      courses: Object.entries(courseStats)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      locations: Object.entries(locationStats)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    }
  })

// ─── ABSENT STATISTICS ──────────────────────────────────────────────────────

export const getAbsentStatistics = authAction
  .metadata({ actionName: 'getAbsentStatistics' })
  .action(async ({ ctx }) => {
    const organizationId = ctx.session.organizationId!

    const absences = await prisma.attendance.findMany({
      where: {
        organizationId,
        status: 'ABSENT',
      },
      include: {
        lesson: true,
        makeupAttendance: true,
      },
      orderBy: {
        lesson: {
          date: 'asc',
        },
      },
    })

    // Цена последнего списания ученика — на случай, когда у пропуска денег нет ни на
    // себе, ни на отработке: предупредил и не отработал. Тогда «сколько стоил бы этот
    // урок» больше взять неоткуда, а средняя по кошельку врала бы задним числом
    // (см. карточку про очередь пакетов).
    const lastPrices = await prisma.$queryRaw<{ studentId: number; price: number }[]>`
      SELECT DISTINCT ON (a."studentId") a."studentId", a.price
      FROM "Attendance" a
      JOIN "Lesson" l ON l.id = a."lessonId"
      WHERE a."organizationId" = ${organizationId} AND a.amount > 0 AND a.price > 0
      ORDER BY a."studentId", l.date DESC, a.id DESC`
    const lastPriceByStudent = new Map(lastPrices.map((r) => [r.studentId, r.price]))

    /**
     * Во сколько школе обошёлся пропуск. Порядок источников — от факта к оценке:
     * списанная проводка самого пропуска, потом проводка его отработки, потом
     * последняя известная цена ученика.
     */
    function priceOf(att: (typeof absences)[number]): number {
      if ((att.amount ?? 0) > 0) return att.price ?? 0
      if ((att.makeupAttendance?.amount ?? 0) > 0) return att.makeupAttendance?.price ?? 0
      return lastPriceByStudent.get(att.studentId) ?? 0
    }

    let rateSum = 0
    let rateCount = 0
    absences.forEach((att) => {
      const rate = priceOf(att)
      if (rate > 0) {
        rateSum += rate
        rateCount++
      }
    })
    const averagePrice = rateCount > 0 ? Math.round(rateSum / rateCount) : 0

    const monthlyStatsMap = new Map<
      string,
      { missed: number; saved: number; missedMoney: number; savedMoney: number; timestamp: number }
    >()
    const weeklyStatsMap = new Map<
      string,
      { missed: number; saved: number; missedMoney: number; savedMoney: number; timestamp: number }
    >()

    absences.forEach((att) => {
      const date = new Date(att.lesson.date)
      const rate = priceOf(att)

      const y = date.getUTCFullYear()
      const m = date.getUTCMonth()
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`

      const day = date.getUTCDay()
      const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(Date.UTC(y, m, diff))
      const weekKey = monday.toISOString().split('T')[0]!

      const isSaved = att.makeupAttendance?.status === 'PRESENT'
      // Спасённое — это уже признанная выручка отработки, а не оценка: урок провели,
      // деньги списали её проводкой.
      const savedRate =
        (att.makeupAttendance?.amount ?? 0) > 0 ? (att.makeupAttendance?.price ?? 0) : rate

      if (!monthlyStatsMap.has(monthKey)) {
        monthlyStatsMap.set(monthKey, {
          missed: 0,
          saved: 0,
          missedMoney: 0,
          savedMoney: 0,
          timestamp: new Date(y, m, 1).getTime(),
        })
      }
      const mStat = monthlyStatsMap.get(monthKey)!
      mStat.missed++
      mStat.missedMoney += rate
      if (isSaved) {
        mStat.saved++
        mStat.savedMoney += savedRate
      }

      if (!weeklyStatsMap.has(weekKey)) {
        weeklyStatsMap.set(weekKey, {
          missed: 0,
          saved: 0,
          missedMoney: 0,
          savedMoney: 0,
          timestamp: monday.getTime(),
        })
      }
      const wStat = weeklyStatsMap.get(weekKey)!
      wStat.missed++
      wStat.missedMoney += rate
      if (isSaved) {
        wStat.saved++
        wStat.savedMoney += savedRate
      }
    })

    const monthly = Array.from(monthlyStatsMap.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([, val]) => {
        const dateRep = new Date(val.timestamp)
        return {
          name: dateRep.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
          missed: val.missed,
          saved: val.saved,
          missedMoney: Math.round(val.missedMoney),
          savedMoney: Math.round(val.savedMoney),
          lossMoney: Math.round(val.missedMoney - val.savedMoney),
        }
      })

    const weekly = Array.from(weeklyStatsMap.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([, val]) => {
        const dateRep = new Date(val.timestamp)
        return {
          name: dateRep.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
          missed: val.missed,
          saved: val.saved,
          missedMoney: Math.round(val.missedMoney),
          savedMoney: Math.round(val.savedMoney),
          lossMoney: Math.round(val.missedMoney - val.savedMoney),
        }
      })

    return {
      averagePrice,
      monthly,
      weekly,
      totalAbsences: absences.length,
      totalSaved: absences.filter((a) => a.makeupAttendance?.status === 'PRESENT').length,
      makeupRate:
        absences.length > 0
          ? Math.round(
              (absences.filter((a) => a.makeupAttendance?.status === 'PRESENT').length /
                absences.length) *
                1000,
            ) / 10
          : 0,
      totalLostMoney: Math.round(monthly.reduce((s, m) => s + m.missedMoney - m.savedMoney, 0)),
      totalSavedMoney: Math.round(monthly.reduce((s, m) => s + m.savedMoney, 0)),
    }
  })
