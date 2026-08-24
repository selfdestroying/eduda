'use server'

import { permissionAction } from '@/src/lib/safe-action'
import { todayYmdInTz } from '@/src/lib/timezone'
import { Prisma, prisma } from '@repo/db'
import { EnrollmentListSchema, ReturnToGroupSchema } from './schemas'
import { ENROLLMENT_LIST_SELECT, type EnrollmentListResult } from './types'

type EnrollmentOrderBy = Prisma.StudentGroupOrderByWithRelationInput

/**
 * Разрешённые колонки сортировки: id колонки таблицы → как её сортировать. Белый
 * список, а не подстановка поля из запроса: `sort` приходит из адресной строки.
 * Неизвестный ключ даёт порядок по умолчанию, без ошибки.
 *
 * Преподавателя здесь нет: их у группы несколько, и «сортировка по списку имён»
 * ничего осмысленного не означает. Баланса и сумм тоже — они на кошельке, а
 * кошелька у записи может не быть вовсе, и Prisma по nullable-связи сортирует
 * непредсказуемо для страницы.
 */
const ENROLLMENT_ORDER_BY: Record<string, (dir: Prisma.SortOrder) => EnrollmentOrderBy[]> = {
  student: (dir) => [{ student: { firstName: dir } }, { student: { lastName: dir } }],
  course: (dir) => [{ group: { course: { name: dir } } }],
  location: (dir) => [{ group: { location: { name: dir } } }],
  statusChangedAt: (dir) => [{ statusChangedAt: dir }],
}

/**
 * Порядок строк. Последними ключами всегда обе половины первичного ключа: у
 * `StudentGroup` он составной (`studentId` + `groupId`), и без такого хвоста
 * строки с равным значением при листании переставляются местами — одна и та же
 * запись успевает показаться на двух страницах подряд.
 */
function resolveOrderBy(
  sort: { id: string; desc: boolean } | null | undefined,
): EnrollmentOrderBy[] {
  const tieBreak: EnrollmentOrderBy[] = [{ studentId: 'desc' }, { groupId: 'desc' }]
  const build = sort ? ENROLLMENT_ORDER_BY[sort.id] : undefined
  if (!sort || !build) return [{ statusChangedAt: 'desc' }, ...tieBreak]
  return [...build(sort.desc ? 'desc' : 'asc'), ...tieBreak]
}

/**
 * Поиск по тому, что видно в строке: ученик, группа, курс, комментарий к статусу.
 *
 * Слова требуются все, но каждое может найтись в любом поле — иначе «Иван Петров»
 * не нашёл бы никого: имя и фамилия лежат в разных колонках, и `contains` по
 * каждой в отдельности не совпадёт с целой фразой. Заодно работает «Петров Иван».
 */
function searchWhere(search: string | undefined): Prisma.StudentGroupWhereInput['AND'] {
  const terms = search?.split(/\s+/).filter(Boolean) ?? []
  if (terms.length === 0) return undefined

  return terms.map((term) => {
    const contains = { contains: term, mode: 'insensitive' as const }
    return {
      OR: [
        { student: { firstName: contains } },
        { student: { lastName: contains } },
        { statusComment: contains },
        { group: { name: contains } },
        { group: { course: { name: contains } } },
      ],
    }
  })
}

/**
 * Записи «ученик — группа» с нужными статусами. Одна выборка на «Активных»,
 * «Завершивших» и «Отчисленных»: списки различаются только `statuses` и набором
 * колонок, а отбор, поиск и порядок у них общие.
 */
export const getEnrollments = permissionAction({ student: ['read'] })
  .metadata({ actionName: 'getEnrollments' })
  .inputSchema(EnrollmentListSchema)
  .action(async ({ ctx, parsedInput }): Promise<EnrollmentListResult> => {
    const { page, pageSize, sort, search, statuses, from, to, courseIds, locationIds, teacherIds } =
      parsedInput

    // Всё, что отбирает по группе, собираем в один объект: `group` в `where` может
    // быть только один, и курс, локация и преподаватель обязаны лечь в него
    // вместе, а не затирать друг друга.
    const groupWhere: Prisma.GroupWhereInput = {
      ...(courseIds.length > 0 && { courseId: { in: courseIds } }),
      ...(locationIds.length > 0 && { locationId: { in: locationIds } }),
      ...(teacherIds.length > 0 && { teachers: { some: { teacherId: { in: teacherIds } } } }),
    }

    const where: Prisma.StudentGroupWhereInput = {
      organizationId: ctx.session.organizationId!,
      status: { in: statuses },
      // Границы включительные и сравниваются как строки — `statusChangedAt` это
      // date-only колонка `YYYY-MM-DD`, где лексикографический порядок совпадает
      // с хронологическим.
      ...((from || to) && {
        statusChangedAt: { ...(from && { gte: from }), ...(to && { lte: to }) },
      }),
      AND: searchWhere(search),
      // Пустой объект отдал бы Prisma лишний join, ничего не отбирая.
      ...(Object.keys(groupWhere).length > 0 && { group: groupWhere }),
    }

    // Одной транзакцией: строки и их количество обязаны быть посчитаны по одному и
    // тому же состоянию базы, иначе между запросами кого-нибудь отчислят и
    // «страница 3 из 5» разъедется с тем, что реально вернулось.
    const [rows, total] = await prisma.$transaction([
      prisma.studentGroup.findMany({
        where,
        select: ENROLLMENT_LIST_SELECT,
        orderBy: resolveOrderBy(sort),
        skip: page * pageSize,
        take: pageSize,
      }),
      prisma.studentGroup.count({ where }),
    ])

    return { rows, total }
  })

export const returnToGroup = permissionAction({ studentGroup: ['update'] })
  .metadata({ actionName: 'returnToGroup' })
  .inputSchema(ReturnToGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { groupId, studentId } = parsedInput
    const organizationId = ctx.session.organizationId!

    await prisma.$transaction(async (tx) => {
      // Чужую запись вернуть нельзя: составной ключ глобален по схеме, и без этой
      // проверки id из другой школы прошёл бы в `update` как свой.
      await tx.studentGroup.findFirstOrThrow({
        where: { studentId, groupId, organizationId },
      })

      const lastAttendance = await tx.attendance.findFirst({
        where: {
          studentId,
          lesson: { groupId },
        },
        include: { lesson: true },
        orderBy: { lesson: { date: 'desc' } },
      })

      await tx.studentGroup.update({
        where: { studentId_groupId: { studentId, groupId } },
        data: {
          status: 'ACTIVE',
          statusComment: null,
          statusChangedAt: todayYmdInTz(ctx.tz),
        },
      })

      // Ученик возвращается на всё, что прошло мимо него: с урока после последнего
      // посещённого, а если он не ходил вовсе — с сегодняшнего дня.
      const lessons = await tx.lesson.findMany({
        where: {
          organizationId,
          groupId,
          date: lastAttendance ? { gt: lastAttendance.lesson.date } : { gte: todayYmdInTz(ctx.tz) },
        },
      })

      if (lessons.length > 0) {
        await tx.attendance.createMany({
          data: lessons.map((lesson) => ({
            organizationId: lesson.organizationId,
            lessonId: lesson.id,
            studentId,
            status: 'UNSPECIFIED' as const,
            comment: '',
          })),
          skipDuplicates: true,
        })
      }
    })
  })
