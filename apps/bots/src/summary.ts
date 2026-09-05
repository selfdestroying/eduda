import { todayYmdInTz, ymdToLocalDate } from '@repo/core/timezone'
import type { Prisma } from '@repo/db'
import { cabinetUrl } from './env'
import { shiftYmd } from './plan'

/**
 * Ответ на привязку: что за дети нашлись, где и когда они занимаются.
 *
 * Это единственное сообщение, где родитель видит, что бот понял его правильно,
 * — поэтому оно подробное, а не «подключено детей: 2». Число ничего не
 * подтверждает: детей может быть двое и в другой семье.
 *
 * Шаблона школы здесь нет намеренно: напоминания школа настраивает под себя, а
 * это ответ бота о том, что он нашёл в базе, — его форма не её дело.
 */

/** `GroupSchedule.dayOfWeek` — воскресенье нулём, как в JS. */
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

/** Дальше двух недель «ближайшее занятие» уже не ближайшее — строку не пишем. */
const HORIZON_DAYS = 14

export async function buildBindSummary(
  db: Prisma.TransactionClient,
  parentIds: number[],
): Promise<string> {
  const parents = await readParents(db, parentIds)
  if (parents.length === 0) return 'Готово! Напоминания о занятиях будут приходить сюда.'

  const todayOf = new Map(
    parents.map((p) => [p.accessToken, todayYmdInTz(p.organization.timezone)]),
  )
  const next = await readNextLessons(db, parents, todayOf)

  const blocks = parents.map((parent) => {
    const today = todayOf.get(parent.accessToken)!

    return [
      `🏫 ${parent.organization.name}`,
      '',
      ...parent.students.flatMap((link) => [...studentLines(link.student, next, today), '']),
      `🔗 Личный кабинет: ${cabinetUrl(parent.accessToken)}`,
    ].join('\n')
  })

  return [
    `Готово, ${parents[0]!.firstName}! 👋`,
    'Напоминания о занятиях теперь приходят сюда.',
    '',
    blocks.join('\n\n'),
    '',
    'Команды: /cabinet — кабинет, /stop — отключить напоминания.',
  ].join('\n')
}

// ─── Данные ─────────────────────────────────────────────────────────

async function readParents(db: Prisma.TransactionClient, parentIds: number[]) {
  return db.parent.findMany({
    where: { id: { in: parentIds } },
    select: {
      firstName: true,
      accessToken: true,
      organization: { select: { name: true, timezone: true } },
      students: {
        select: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              groups: {
                // Отчисленные и завершившие остаются записями в группе, а
                // архивные группы — группами: рассказывать о них нечего.
                where: { status: { in: ['ACTIVE', 'TRIAL'] }, group: { status: 'ACTIVE' } },
                select: {
                  status: true,
                  wallet: { select: { lessonsBalance: true } },
                  group: {
                    select: {
                      id: true,
                      course: { select: { name: true } },
                      location: { select: { name: true } },
                      schedules: { select: { dayOfWeek: true, time: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
}

type Parents = Awaited<ReturnType<typeof readParents>>
type Student = Parents[number]['students'][number]['student']

/**
 * Ближайшее занятие каждой группы — одним запросом на всё сообщение.
 *
 * Горизонт вместо `distinct`: у родителя бывают школы в разных поясах, и «уже
 * сегодня» у них разное, поэтому первую строку на группу выбираем сами, зная
 * чей это день. Две недели строк — это десятки, а не тысячи.
 */
async function readNextLessons(
  db: Prisma.TransactionClient,
  parents: Parents,
  todayOf: Map<string, string>,
) {
  const groupDay = new Map<number, string>()

  for (const parent of parents) {
    const today = todayOf.get(parent.accessToken)!
    for (const link of parent.students) {
      for (const enrolment of link.student.groups) groupDay.set(enrolment.group.id, today)
    }
  }

  const next = new Map<number, { date: string; time: string }>()
  if (groupDay.size === 0) return next

  const floor = [...groupDay.values()].sort()[0]!

  const lessons = await db.lesson.findMany({
    where: {
      groupId: { in: [...groupDay.keys()] },
      status: 'ACTIVE',
      date: { gte: floor, lte: shiftYmd(floor, HORIZON_DAYS) },
    },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    select: { groupId: true, date: true, time: true },
  })

  for (const lesson of lessons) {
    if (next.has(lesson.groupId)) continue
    if (lesson.date < groupDay.get(lesson.groupId)!) continue
    next.set(lesson.groupId, { date: lesson.date, time: lesson.time })
  }

  return next
}

// ─── Текст ──────────────────────────────────────────────────────────

/**
 * Блок одного ребёнка. Про ребёнка без групп сказано бесполо: пол в базе не
 * хранится, а «не записан» про Аню читается как ошибка бота.
 */
function studentLines(
  student: Student,
  next: Map<number, { date: string; time: string }>,
  today: string,
): string[] {
  const name = [student.firstName, student.lastName].filter(Boolean).join(' ')

  if (student.groups.length === 0) return [`👤 ${name}`, '   Пока нет активных групп.']

  return [
    `👤 ${name}`,
    // Пустая строка между группами: у ребёнка их бывает две, и без разделителя
    // шесть строк подряд читаются как одна группа с двумя расписаниями.
    ...student.groups.flatMap((enrolment, index) => {
      const lesson = next.get(enrolment.group.id)
      const balance = enrolment.wallet?.lessonsBalance ?? 0

      return [
        ...(index > 0 ? [''] : []),
        `   🎓 ${enrolment.group.course.name}${enrolment.status === 'TRIAL' ? ' (пробное)' : ''}`,
        `   📍 ${enrolment.group.location.name}`,
        ...maybe(scheduleWords(enrolment.group.schedules), (words) => `   🗓 ${words}`),
        ...maybe(lesson, (l) => `   ⏰ Ближайшее занятие: ${whenWords(l.date, l.time, today)}`),
        // Ноль — это и «занятия кончились», и «школа пакетами не пользуется».
        // Различить их здесь нечем, поэтому молчим.
        ...maybe(balance > 0 ? balance : null, (n) => `   🎟 Осталось занятий: ${n}`),
      ]
    }),
  ]
}

function maybe<T>(value: T | null | undefined, render: (value: T) => string): string[] {
  return value === null || value === undefined || value === '' ? [] : [render(value)]
}

/**
 * «пн, ср в 17:00» — когда время одно на все дни, иначе «пн 17:00, чт 18:30».
 * Понедельник первый: воскресенье в базе нулевое, а у человека последнее.
 */
function scheduleWords(schedules: { dayOfWeek: number; time: string }[]): string {
  const sorted = [...schedules].sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7))
  if (sorted.length === 0) return ''

  const days = sorted.map((s) => WEEKDAYS[s.dayOfWeek] ?? '?')
  const sameTime = sorted.every((s) => s.time === sorted[0]!.time)

  return sameTime
    ? `${days.join(', ')} в ${sorted[0]!.time}`
    : sorted.map((s, i) => `${days[i]} ${s.time}`).join(', ')
}

/** «сегодня в 17:00», «завтра в 17:00», «пн, 8 сентября в 17:00». */
function whenWords(ymd: string, time: string, today: string): string {
  if (ymd === today) return `сегодня в ${time}`
  if (ymd === shiftYmd(today, 1)) return `завтра в ${time}`

  const date = ymdToLocalDate(ymd)
  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  return `${WEEKDAYS[date.getDay()]}, ${day} в ${time}`
}
