/**
 * Самопроверка планировщика и дренажа — настоящим кодом против настоящей БД.
 *
 * Всё внутри одной транзакции, которая в конце откатывается. Мока Prisma нет:
 * половина проверяемого — поведение самой базы (уникальный `dedupeKey`, отбор
 * по статусу и сроку, каскады), и мок бы её как раз и не проверил.
 *
 *   pnpm --filter bots check:notifications
 */
import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import { drainOutbox, type Sender } from '../src/drain'
import { planLessonReminders } from '../src/plan'

class Rollback extends Error {}

/** Москва +3: 18:00 UTC — это 21:00 по школе, то есть после 20:00. */
const AFTER = new Date('2026-09-10T18:00:00Z')
/** Тот же день, 10:00 по школе — час отправки ещё не наступил. */
const BEFORE = new Date('2026-09-10T07:00:00Z')
/** Режим «накануне» — значит план на завтра. */
const TARGET = '2026-09-11'

/** Сегодня для режима «в день занятия»: тот же день, что у `AFTER`/`BEFORE`. */
const TODAY = '2026-09-10'
/** 15:00 по школе. При запасе в два часа окно — [15:00, 17:00]. */
const AT_15 = new Date('2026-09-10T12:00:00Z')
/** 17:30 по школе: окно [17:30, 19:30] — сюда попадает только занятие в 19:00. */
const AT_17_30 = new Date('2026-09-10T14:30:00Z')

async function main() {
  try {
    await prisma.$transaction(
      async (tx) => {
        // ─── Школа с напоминаниями и школа с выключенной фичей ────────────
        const makeOrg = async (slug: string, mode: 'DAY_BEFORE' | 'SAME_DAY' = 'DAY_BEFORE') =>
          tx.organization.create({
            data: {
              name: slug,
              slug,
              timezone: 'Europe/Moscow',
              remindersEnabled: true,
              reminderMode: mode,
              reminderTime: '20:00',
              reminderLeadMinutes: 120,
            },
            select: { id: true },
          })

        const stamp = Date.now()
        const orgA = await makeOrg(`check-notify-a-${stamp}`)
        const orgB = await makeOrg(`check-notify-b-${stamp}`)

        await tx.organizationFeature.create({
          data: { organizationId: orgB.id, featureKey: 'notifications', enabled: false },
        })

        // ─── Декорации: курс, локация, группа, занятия ────────────────────
        const scenery = async (organizationId: number) => {
          const course = await tx.course.create({
            data: { organizationId, name: 'Робототехника' },
            select: { id: true },
          })
          const location = await tx.location.create({
            data: { organizationId, name: 'Ленина 5' },
            select: { id: true },
          })
          const group = await tx.group.create({
            data: {
              organizationId,
              courseId: course.id,
              locationId: location.id,
              name: 'Проверка напоминаний',
              startDate: '2026-09-01',
              maxStudents: 10,
            },
            select: { id: true },
          })
          await tx.lesson.create({
            data: { organizationId, groupId: group.id, date: TARGET, time: '17:00' },
          })
          // Отменённое занятие в тот же день напоминанием не становится.
          await tx.lesson.create({
            data: {
              organizationId,
              groupId: group.id,
              date: TARGET,
              time: '19:00',
              status: 'CANCELLED',
            },
          })
          return group.id
        }

        const groupA = await scenery(orgA.id)
        const groupB = await scenery(orgB.id)

        // ─── Ученики, родители, привязки ──────────────────────────────────
        let messengerSeq = 0
        const enrol = async (
          organizationId: number,
          groupId: number,
          firstName: string,
          status: 'ACTIVE' | 'TRIAL' | 'DISMISSED',
          messenger: 'active' | 'unsubscribed' | 'none',
        ) => {
          const student = await tx.student.create({
            data: { firstName, lastName: 'Проверкин', organizationId },
            select: { id: true },
          })
          await tx.studentGroup.create({
            data: {
              organizationId,
              studentId: student.id,
              groupId,
              status,
              statusChangedAt: '2026-09-01',
            },
          })
          const parent = await tx.parent.create({
            data: { firstName: `Родитель ${firstName}`, organizationId },
            select: { id: true },
          })
          await tx.studentParent.create({
            data: { organizationId, studentId: student.id, parentId: parent.id },
          })

          if (messenger === 'none') return null

          const row = await tx.parentMessenger.create({
            data: {
              provider: 'VK',
              externalId: `check-${stamp}-${(messengerSeq += 1)}`,
              parentId: parent.id,
              organizationId,
              unsubscribedAt: messenger === 'unsubscribed' ? new Date() : null,
            },
            select: { id: true, externalId: true },
          })
          return row
        }

        const wanted = await enrol(orgA.id, groupA, 'Пётр', 'ACTIVE', 'active')
        await enrol(orgA.id, groupA, 'Отчисленный', 'DISMISSED', 'active')
        await enrol(orgA.id, groupA, 'Отписавшийся', 'ACTIVE', 'unsubscribed')
        await enrol(orgB.id, groupB, 'Чужой', 'ACTIVE', 'active')

        const planned = (organizationId: number) =>
          tx.notificationOutbox.count({ where: { organizationId } })

        // ─── Час отправки ещё не наступил ─────────────────────────────────
        await planLessonReminders(tx, BEFORE)
        assert.equal(await planned(orgA.id), 0, 'до reminderTime ничего не планируется')

        // ─── Основной проход ──────────────────────────────────────────────
        await planLessonReminders(tx, AFTER)
        assert.equal(await planned(orgA.id), 1, 'ровно одно напоминание на активную привязку')
        assert.equal(await planned(orgB.id), 0, 'школа с выключенной фичей пропущена')

        const row = await tx.notificationOutbox.findFirstOrThrow({
          where: { organizationId: orgA.id },
          select: { text: true, dedupeKey: true, status: true, parentMessengerId: true },
        })
        assert.equal(row.parentMessengerId, wanted!.id, 'напоминание ушло нужной привязке')
        assert.equal(row.status, 'PENDING', 'свежая строка ждёт отправки')
        assert.equal(row.dedupeKey, `lesson-reminder:${wanted!.id}:${TARGET}`, 'ключ дедупликации')
        assert.match(row.text, /^Завтра, 11 сентября/, 'дата словами')
        assert.match(
          row.text,
          /• Пётр Проверкин — Робототехника, 17:00, Ленина 5/,
          'строка занятия',
        )
        assert.ok(!row.text.includes('Отчисленный'), 'отчисленный не попал')
        assert.ok(!row.text.includes('19:00'), 'отменённое занятие не попало')

        // ─── Повтор ───────────────────────────────────────────────────────
        const again = await planLessonReminders(tx, AFTER)
        assert.equal(again.planned, 0, 'повторный запуск ничего не добавляет')
        assert.equal(await planned(orgA.id), 1, 'строка по-прежнему одна')

        // ─── Режим «в день занятия» ───────────────────────────────────────
        // Один родитель, трое детей, три разных времени: именно на этом видно,
        // что сообщение здесь про урок, а не про день.
        const slugC = `check-notify-c-${stamp}`
        const orgC = await makeOrg(slugC, 'SAME_DAY')

        // Свои шаблоны школы: планировщик обязан собирать сообщение по ним, а не
        // по зашитому тексту — иначе редактор в платформе ни на что не влияет.
        // Оба уровня сразу: тело рендерится один раз, строка — на каждое занятие.
        await tx.organization.update({
          where: { id: orgC.id },
          data: {
            reminderTemplate: 'Школа {школа}, {дата}. {когда}\n\n{занятия}',
            reminderLineTemplate: '{ученик} ({курс}) в {время}, {место}',
          },
        })

        const courseC = await tx.course.create({
          data: { organizationId: orgC.id, name: 'Программирование' },
          select: { id: true },
        })
        const locationC = await tx.location.create({
          data: { organizationId: orgC.id, name: 'Центр' },
          select: { id: true },
        })
        const parentC = await tx.parent.create({
          data: { firstName: 'Родитель троих', organizationId: orgC.id },
          select: { id: true },
        })
        const messengerC = await tx.parentMessenger.create({
          data: {
            provider: 'VK',
            externalId: `check-${stamp}-same-day`,
            parentId: parentC.id,
            organizationId: orgC.id,
          },
          select: { id: true },
        })

        const child = async (firstName: string, time: string) => {
          const group = await tx.group.create({
            data: {
              organizationId: orgC.id,
              courseId: courseC.id,
              locationId: locationC.id,
              name: `Группа ${time}`,
              startDate: '2026-09-01',
              maxStudents: 10,
            },
            select: { id: true },
          })
          await tx.lesson.create({
            data: { organizationId: orgC.id, groupId: group.id, date: TODAY, time },
          })
          const student = await tx.student.create({
            data: { firstName, lastName: 'Проверкин', organizationId: orgC.id },
            select: { id: true },
          })
          await tx.studentGroup.create({
            data: {
              organizationId: orgC.id,
              studentId: student.id,
              groupId: group.id,
              status: 'ACTIVE',
              statusChangedAt: '2026-09-01',
            },
          })
          await tx.studentParent.create({
            data: { organizationId: orgC.id, studentId: student.id, parentId: parentC.id },
          })
        }

        await child('Ранний', '13:00')
        await child('Дневной', '16:00')
        await child('Вечерний', '19:00')

        const outboxC = () =>
          tx.notificationOutbox.findMany({
            where: { organizationId: orgC.id },
            orderBy: { id: 'asc' },
            select: { dedupeKey: true, text: true },
          })

        // 10:00 по школе — окно [10:00, 12:00], в него не попадает ничего.
        await planLessonReminders(tx, BEFORE)
        assert.equal((await outboxC()).length, 0, 'до окна ничего не планируется')

        await planLessonReminders(tx, AT_15)
        let sameDay = await outboxC()
        assert.equal(sameDay.length, 1, 'в окно [15:00, 17:00] попало только занятие в 16:00')
        assert.equal(
          sameDay[0]!.dedupeKey,
          `lesson-reminder:${messengerC.id}:${TODAY}:16:00`,
          'ключ включает время урока: сообщение здесь про урок, а не про день',
        )
        // Целиком, а не по кускам: это единственное место, где видно, что
        // сообщение собрано ровно по обоим шаблонам школы и что ничего своего
        // планировщик не дописывает.
        assert.equal(
          sameDay[0]!.text,
          [
            `Школа ${slugC}, 10 сентября. Сегодня, 10 сентября`,
            '',
            'Дневной Проверкин (Программирование) в 16:00, Центр',
          ].join('\n'),
          'сообщение собрано по шаблонам школы — и телу, и строке занятия',
        )

        await planLessonReminders(tx, AT_15)
        assert.equal((await outboxC()).length, 1, 'повтор в том же окне ничего не добавляет')

        await planLessonReminders(tx, AT_17_30)
        sameDay = await outboxC()
        assert.equal(sameDay.length, 2, 'следующее время урока — отдельное сообщение')
        assert.equal(
          sameDay[1]!.dedupeKey,
          `lesson-reminder:${messengerC.id}:${TODAY}:19:00`,
          'у него свой ключ',
        )
        // Шапка у обоих писем теперь одинаковая — день, а не время: различает
        // их строка занятия, где время и живёт.
        assert.match(
          sameDay[1]!.text,
          /Вечерний Проверкин \(Программирование\) в 19:00/,
          'и своё время урока — в строке занятия',
        )
        assert.ok(
          sameDay.every((row) => !row.text.includes('Ранний')),
          'занятие, которое уже началось, задним числом не напоминается',
        )

        // ─── Дренаж ───────────────────────────────────────────────────────
        const outbox = async (externalId: string, attempts = 0) => {
          // Своя привязка на каждую строку: `blocked` гасит привязку, и общая
          // на всех подменяла бы результат соседних проверок.
          const parent = await tx.parent.create({
            data: { firstName: externalId, organizationId: orgA.id },
            select: { id: true },
          })
          const messenger = await tx.parentMessenger.create({
            data: { provider: 'VK', externalId, parentId: parent.id, organizationId: orgA.id },
            select: { id: true },
          })
          return tx.notificationOutbox.create({
            data: {
              kind: 'LESSON_REMINDER',
              dedupeKey: `drain:${externalId}`,
              text: 'проверка',
              organizationId: orgA.id,
              parentMessengerId: messenger.id,
              attempts,
            },
            select: { id: true, parentMessengerId: true },
          })
        }

        const okRow = await outbox(`drain-ok-${stamp}`)
        const blockedRow = await outbox(`drain-blocked-${stamp}`)
        const retryRow = await outbox(`drain-retry-${stamp}`)
        const lastRow = await outbox(`drain-last-${stamp}`, 4)

        const sender: Sender = async (externalId) => {
          if (externalId.startsWith('drain-blocked')) {
            return { ok: false, retryable: false, blocked: true, error: 'VK 901' }
          }
          if (externalId.startsWith('drain-retry') || externalId.startsWith('drain-last')) {
            return { ok: false, retryable: true, error: 'сеть' }
          }
          return { ok: true }
        }

        const now = new Date('2026-09-10T18:05:00Z')
        await drainOutbox(tx, { VK: sender }, { now, pauseMs: 0 })

        const state = (id: number) =>
          tx.notificationOutbox.findFirstOrThrow({
            where: { id },
            select: { status: true, attempts: true, nextAttemptAt: true, sentAt: true },
          })

        const sent = await state(okRow.id)
        assert.equal(sent.status, 'SENT', 'успешная отправка закрыта')
        assert.equal(sent.sentAt?.getTime(), now.getTime(), 'проставлено время отправки')

        const blocked = await state(blockedRow.id)
        assert.equal(blocked.status, 'FAILED', 'запрет сообщений — не повод повторять')
        const messenger = await tx.parentMessenger.findFirstOrThrow({
          where: { id: blockedRow.parentMessengerId },
          select: { unsubscribedAt: true },
        })
        assert.ok(messenger.unsubscribedAt, 'привязка погашена, иначе план наберёт снова')

        const retried = await state(retryRow.id)
        assert.equal(retried.status, 'PENDING', 'сетевая ошибка — повторим')
        assert.equal(retried.attempts, 1, 'попытка засчитана')
        assert.ok(retried.nextAttemptAt > now, 'срок повтора отодвинут')

        const exhausted = await state(lastRow.id)
        assert.equal(exhausted.status, 'FAILED', 'пятая попытка — отказ')
        assert.equal(exhausted.attempts, 5, 'попытки не теряются')

        // ─── Провайдер не подключён ───────────────────────────────────────
        await drainOutbox(tx, {}, { now, pauseMs: 0 })
        const orphan = await state(retryRow.id)
        assert.equal(orphan.status, 'PENDING', 'срок ещё не подошёл, строку не трогали')

        throw new Rollback()
      },
      // Сценарий большой, а дефолтные пять секунд Prisma считает от начала.
      { timeout: 60_000 },
    )
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  const leftovers = await prisma.notificationOutbox.count({
    where: { dedupeKey: { startsWith: 'drain:' } },
  })
  assert.equal(leftovers, 0, 'транзакция откатилась, строк не осталось')

  console.log('check-notifications: всё сошлось')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
