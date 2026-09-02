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
/** `reminderLeadDays: 1`, значит план на завтра. */
const TARGET = '2026-09-11'

async function main() {
  try {
    await prisma.$transaction(
      async (tx) => {
        // ─── Школа с напоминаниями и школа с выключенной фичей ────────────
        const makeOrg = async (slug: string) =>
          tx.organization.create({
            data: {
              name: slug,
              slug,
              timezone: 'Europe/Moscow',
              remindersEnabled: true,
              reminderTime: '20:00',
              reminderLeadDays: 1,
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
        assert.match(row.text, /• Пётр — Робототехника, 17:00, Ленина 5/, 'строка занятия')
        assert.ok(!row.text.includes('Отчисленный'), 'отчисленный не попал')
        assert.ok(!row.text.includes('19:00'), 'отменённое занятие не попало')

        // ─── Повтор ───────────────────────────────────────────────────────
        const again = await planLessonReminders(tx, AFTER)
        assert.equal(again.planned, 0, 'повторный запуск ничего не добавляет')
        assert.equal(await planned(orgA.id), 1, 'строка по-прежнему одна')

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
