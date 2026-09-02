import { isFeatureDisabled } from '@repo/core/features'
import { dateToYmd, formatInTz, ymdToLocalDate } from '@repo/core/timezone'
import type { Prisma } from '@repo/db'

/**
 * Планировщик напоминаний. Состояния «когда я запускался в прошлый раз» у него
 * нет: повтор гасит уникальный `dedupeKey`, поэтому крон может приходить хоть
 * каждые десять минут — из ста сорока четырёх заходов в сутки сто сорок три
 * холостые, и это дешевле, чем курсор, который надо чинить после простоя.
 *
 * Сервер лежал в 20:00 — план уедет в 20:10, потому что условие «локальное
 * время уже прошло reminderTime», а не «равно ему».
 */

const KIND = 'LESSON_REMINDER'

/** Что попадёт в сообщение про одного ребёнка на одном занятии. */
type Row = { student: string; course: string; time: string; location: string }

export type PlanResult = { organizations: number; planned: number }

export async function planLessonReminders(
  db: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<PlanResult> {
  const organizations = await db.organization.findMany({
    where: { remindersEnabled: true },
    select: { id: true, timezone: true, reminderTime: true, reminderLeadDays: true },
  })

  let planned = 0
  let counted = 0

  for (const org of organizations) {
    // Час отправки ещё не наступил по местному времени школы.
    if (formatInTz(now, org.timezone, 'HH:mm') < org.reminderTime) continue

    const disabled = await db.organizationFeature.findMany({
      where: { organizationId: org.id, enabled: false },
      select: { featureKey: true },
    })
    if (
      isFeatureDisabled(
        disabled.map((f) => f.featureKey),
        'notifications',
      )
    )
      continue

    counted += 1
    planned += await planOrganization(db, org, now)
  }

  return { organizations: counted, planned }
}

type Org = {
  id: number
  timezone: string
  reminderTime: string
  reminderLeadDays: number
}

async function planOrganization(db: Prisma.TransactionClient, org: Org, now: Date) {
  const targetDate = shiftYmd(formatInTz(now, org.timezone, 'yyyy-MM-dd'), org.reminderLeadDays)

  const lessons = await db.lesson.findMany({
    where: { organizationId: org.id, date: targetDate, status: 'ACTIVE' },
    orderBy: { time: 'asc' },
    select: {
      time: true,
      group: {
        select: {
          course: { select: { name: true } },
          location: { select: { name: true } },
          // Отчисленные и завершившие в группе остаются — напоминать им нечего.
          students: {
            where: { status: { in: ['ACTIVE', 'TRIAL'] } },
            select: {
              student: {
                select: {
                  firstName: true,
                  parents: {
                    select: {
                      parent: {
                        select: {
                          messengers: {
                            where: { unsubscribedAt: null },
                            select: { id: true },
                          },
                        },
                      },
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

  // Одно сообщение на привязку на день, со всеми детьми сразу: два ребёнка —
  // это две строки в одном сообщении, а не два сообщения подряд.
  const byMessenger = new Map<number, Row[]>()

  for (const lesson of lessons) {
    for (const enrolment of lesson.group.students) {
      const row: Row = {
        student: enrolment.student.firstName,
        course: lesson.group.course.name,
        time: lesson.time,
        location: lesson.group.location.name,
      }

      for (const link of enrolment.student.parents) {
        for (const messenger of link.parent.messengers) {
          const rows = byMessenger.get(messenger.id)
          if (rows) rows.push(row)
          else byMessenger.set(messenger.id, [row])
        }
      }
    }
  }

  if (byMessenger.size === 0) return 0

  const { count } = await db.notificationOutbox.createMany({
    data: [...byMessenger].map(([parentMessengerId, rows]) => ({
      kind: KIND,
      dedupeKey: `lesson-reminder:${parentMessengerId}:${targetDate}`,
      text: buildText(targetDate, org.reminderLeadDays, rows),
      organizationId: org.id,
      parentMessengerId,
    })),
    // Весь механизм идемпотентности планировщика — здесь.
    skipDuplicates: true,
  })

  return count
}

/**
 * Сдвиг календарного дня строкой `YYYY-MM-DD`. Через полдень локального дня:
 * на переходе часов сутки бывают короче, и от полуночи `+1 день` иногда
 * возвращает тот же день.
 */
function shiftYmd(ymd: string, days: number): string {
  const date = ymdToLocalDate(ymd)
  date.setDate(date.getDate() + days)
  return dateToYmd(date)
}

function buildText(targetDate: string, leadDays: number, rows: Row[]): string {
  const when = leadDays === 0 ? 'Сегодня' : 'Завтра'
  const day = ymdToLocalDate(targetDate).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })

  const lines = rows.map((row) => `• ${row.student} — ${row.course}, ${row.time}, ${row.location}`)

  return [
    `${when}, ${day}`,
    '',
    ...lines,
    '',
    'Не сможете прийти — отметьте в кабинете. Отключить напоминания — /stop',
  ].join('\n')
}
