/**
 * Перенос пакетов между кошельками: механика и её границы.
 *
 * `check-money-cases.ts` проверяет, как деньги живут внутри одного кошелька, этот
 * скрипт — что происходит, когда пакет меняет кошелёк: едут ли счётчики, куда
 * возвращается урок при откате, что делает очередь и чего перенос не трогает.
 *
 * Каждый случай живёт на своём ученике, чтобы порядок выполнения ничего не решал.
 * Всё внутри одной транзакции, которая в конце откатывается.
 *
 *   pnpm --filter platform exec tsx scripts/check-wallet-transfer.ts
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import { AttendanceStatus, WalletEntryKind } from '@repo/db/enums'
import {
  activatePackageTx,
  cancelPackageTx,
  chargeAttendanceTx,
  isLessonCharged,
  unchargeAttendanceTx,
  unitPriceOf,
} from '../src/features/finances/ledger.server'
import { transferPackagesTx } from '../src/features/finances/transfer.server'
import { ConflictError, NotFoundError } from '../src/lib/error'

class Rollback extends Error {}

const LAST_NAME = 'Перенос'
const TODAY = '2027-03-01'

let passed = 0
const ok = (name: string) => {
  passed += 1
  console.log(`  ✓ ${name}`)
}

async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true } })
  if (!org) throw new Error('В базе нет ни одной организации — проверять не на чем')
  const organizationId = org.id

  // ─── Предусловия против настоящей базы ───────────────────────────────
  // На них держится перенос: если они не выполняются уже сейчас, счётчики уедут
  // в минус, а пакет попадёт не тому ученику.
  console.log('Предусловия')
  {
    const [counters] = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM (
        SELECT w.id,
               w."totalLessons"  - COALESCE(SUM(p."lessonCount"), 0) AS dl,
               w."totalPayments" - COALESCE(SUM(p."price"), 0)       AS dp
        FROM "Wallet" w
        LEFT JOIN "Package" p ON p."walletId" = w.id AND p.status = 'ACTIVE'
        GROUP BY w.id, w."totalLessons", w."totalPayments"
      ) t WHERE dl < 0 OR dp < 0`
    console.log(`  кошельков, где счётчик меньше суммы пакетов: ${counters?.n ?? 0}`)

    const mismatched = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM "Package" p
      JOIN "Wallet" w ON w.id = p."walletId"
      WHERE p."studentId" <> w."studentId" OR p."organizationId" <> w."organizationId"`
    assert.equal(
      Number(mismatched[0]?.n ?? 0),
      0,
      'у пакета владелец разошёлся с владельцем его кошелька',
    )
    ok('владелец пакета совпадает с владельцем кошелька')
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // ─── Декорации ─────────────────────────────────────────────────
        const course = await tx.course.create({
          data: { organizationId, name: 'Перенос пакетов' },
          select: { id: true },
        })
        const location = await tx.location.create({
          data: { organizationId, name: 'Перенос пакетов' },
          select: { id: true },
        })
        const makeGroup = async (name: string) =>
          await tx.group.create({
            data: {
              organizationId,
              courseId: course.id,
              locationId: location.id,
              name,
              startDate: '2026-09-01',
              maxStudents: 20,
            },
            select: { id: true },
          })
        const groupOne = await makeGroup('Перенос 1')
        const groupTwo = await makeGroup('Перенос 2')

        let day = 0
        const nextDate = () => {
          day += 1
          return `2026-${String(9 + Math.floor(day / 28)).padStart(2, '0')}-${String((day % 28) + 1).padStart(2, '0')}`
        }

        /** Ученик с двумя кошельками: источник привязан к группе, получатель пуст. */
        const scene = async (name: string, groupId = groupOne.id) => {
          const student = await tx.student.create({
            data: { firstName: name, lastName: LAST_NAME, organizationId },
            select: { id: true },
          })
          const from = await tx.wallet.create({
            data: { organizationId, studentId: student.id, name: `${name}: источник` },
            select: { id: true },
          })
          const to = await tx.wallet.create({
            data: { organizationId, studentId: student.id, name: `${name}: получатель` },
            select: { id: true },
          })
          await tx.studentGroup.create({
            data: {
              organizationId,
              studentId: student.id,
              groupId,
              walletId: from.id,
              status: 'ACTIVE',
              statusChangedAt: '2026-09-01',
            },
          })
          return { studentId: student.id, from: from.id, to: to.id }
        }

        const visit = async (opts: {
          studentId: number
          groupId?: number
          walletId?: number | null
        }) => {
          const lesson = await tx.lesson.create({
            data: {
              organizationId,
              groupId: opts.groupId ?? groupOne.id,
              date: nextDate(),
              time: '10:00',
            },
            select: { id: true },
          })
          const attendance = await tx.attendance.create({
            data: {
              organizationId,
              studentId: opts.studentId,
              lessonId: lesson.id,
              status: AttendanceStatus.UNSPECIFIED,
              walletId: opts.walletId ?? null,
            },
            select: { id: true },
          })
          return attendance.id
        }

        /** То же, что делает `updateAttendanceStatus`: сначала статус, потом деньги. */
        const mark = async (attendanceId: number, status: AttendanceStatus) => {
          const before = await tx.attendance.findUniqueOrThrow({
            where: { id: attendanceId },
            select: { status: true, isWarned: true, makeupForAttendanceId: true },
          })
          await tx.attendance.update({ where: { id: attendanceId }, data: { status } })
          const was = isLessonCharged(before)
          const now = isLessonCharged({ ...before, status })
          if (was === now) return
          const money = { attendanceId, organizationId, actorUserId: null }
          if (now) await chargeAttendanceTx(tx, money)
          else await unchargeAttendanceTx(tx, money)
        }

        /** Пакет, по умолчанию выданный. `received: false` оставляет его черновиком. */
        const pay = async (opts: {
          walletId: number
          studentId: number
          date: string
          price: number
          lessonCount: number
          received?: boolean
        }) => {
          const packet = await tx.package.create({
            data: {
              organizationId,
              studentId: opts.studentId,
              walletId: opts.walletId,
              date: opts.date,
              price: opts.price,
              lessonCount: opts.lessonCount,
              remaining: opts.lessonCount,
              unitPrice: unitPriceOf(opts),
              productName: 'Абонемент',
            },
            select: { id: true },
          })
          if (opts.received !== false) {
            await activatePackageTx(tx, { packageId: packet.id, organizationId, actorUserId: null })
          }
          return packet.id
        }

        const move = async (packageIds: number[], toWalletId: number) =>
          await transferPackagesTx(tx, {
            packageIds,
            toWalletId,
            organizationId,
            actorUserId: null,
            effectiveAt: TODAY,
          })

        const wallet = async (id: number) =>
          await tx.wallet.findUniqueOrThrow({
            where: { id },
            select: { lessonsBalance: true, totalLessons: true, totalPayments: true },
          })
        const packet = async (id: number) =>
          await tx.package.findUniqueOrThrow({
            where: { id },
            select: { walletId: true, remaining: true, status: true },
          })
        const entryOf = async (id: number) =>
          await tx.attendance.findUniqueOrThrow({
            where: { id },
            select: { packageId: true, price: true, amount: true },
          })
        const ledgerSumOf = async (walletId: number) =>
          (await tx.walletEntry.aggregate({ where: { walletId }, _sum: { quantity: true } }))._sum
            .quantity ?? 0
        const transfersOf = async (packageId: number) =>
          await tx.walletEntry.findMany({
            where: { packageId, kind: WalletEntryKind.TRANSFER },
            orderBy: { id: 'asc' },
            select: { walletId: true, quantity: true, unitPrice: true, attendanceId: true },
          })

        // ─── Простой перенос ───────────────────────────────────────────
        console.log('\nПеренос')

        {
          const s = await scene('Целиком')
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 8_000,
            lessonCount: 8,
          })
          const result = await move([p], s.to)

          assert.equal(result.moved, 8)
          assert.deepEqual(await wallet(s.from), {
            lessonsBalance: 0,
            totalLessons: 0,
            totalPayments: 0,
          })
          assert.deepEqual(await wallet(s.to), {
            lessonsBalance: 8,
            totalLessons: 8,
            totalPayments: 8_000,
          })
          assert.equal((await packet(p)).remaining, 8, 'остаток пакета перенос не трогает')

          const rows = await transfersOf(p)
          assert.equal(rows.length, 2, 'ровно две строки журнала')
          assert.deepEqual(
            rows.map((r) => [r.walletId, r.quantity]),
            [
              [s.from, -8],
              [s.to, 8],
            ],
          )
          assert.ok(
            rows.every((r) => r.attendanceId === null),
            'строки переноса не про занятия — иначе они попадут в выручку',
          )
          ok('нетронутый пакет уезжает вместе с балансом и счётчиками')
        }

        {
          const s = await scene('Частично')
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 10_000,
            lessonCount: 10,
          })
          const v = await visit({ studentId: s.studentId })
          await mark(v, AttendanceStatus.PRESENT)

          await move([p], s.to)

          assert.equal((await wallet(s.from)).lessonsBalance, 0)
          assert.equal((await wallet(s.to)).lessonsBalance, 9, 'уехал остаток, а не размер')
          // Счётчики двигаются на размер и цену: списания их не уменьшали.
          assert.equal((await wallet(s.to)).totalLessons, 10)
          assert.equal((await wallet(s.to)).totalPayments, 10_000)
          assert.equal((await entryOf(v)).packageId, p, 'проводка списанного занятия не тронута')
          assert.equal((await entryOf(v)).price, 1_000, 'и цена на ней прежняя')
          ok('частично потраченный пакет: едет остаток, счётчики — целиком')
        }

        {
          const s = await scene('Досуха')
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 1_000,
            lessonCount: 1,
          })
          const v = await visit({ studentId: s.studentId })
          await mark(v, AttendanceStatus.PRESENT)

          const before = await tx.studentLessonsBalanceHistory.count({
            where: { studentId: s.studentId },
          })
          await move([p], s.to)
          const after = await tx.studentLessonsBalanceHistory.count({
            where: { studentId: s.studentId },
          })

          assert.equal((await wallet(s.to)).lessonsBalance, 0)
          assert.equal(
            after - before,
            4,
            'нулевая дельта баланса истории не пишет, а счётчики — да',
          )
          ok('полностью потраченный пакет переносится без движения баланса')
        }

        // ─── Неоплаченный пакет ────────────────────────────────────────
        console.log('\nНеоплаченный пакет')

        {
          const s = await scene('Черновик')
          // У получателя занятие, за которое платить нечем: пакетов на нём нет.
          const waiting = await visit({ studentId: s.studentId, walletId: s.to })
          await mark(waiting, AttendanceStatus.PRESENT)
          assert.equal((await entryOf(waiting)).price, null, 'занятие ждёт оплаты')

          const draft = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-10-01',
            price: 9_000,
            lessonCount: 9,
            received: false,
          })
          const result = await move([draft], s.to)

          assert.equal(result.moved, 0, 'черновик уроков не даёт')
          assert.equal((await packet(draft)).walletId, s.to, 'но владельца меняет')
          assert.equal((await packet(draft)).remaining, 9)
          assert.equal(await tx.walletEntry.count({ where: { packageId: draft } }), 0)
          assert.equal((await wallet(s.to)).lessonsBalance, 0, 'баланс получателя не двигает')
          // Главное: остаток черновика равен размеру, и погасить им ждущее занятие
          // значило бы потратить деньги, которых не приходило.
          assert.equal(result.settled, 0, 'и ничего не гасит')
          assert.equal((await entryOf(waiting)).price, null, 'занятие так и ждёт')

          // А после подтверждения счёта уроки ложатся уже на получателя — и вот тогда
          // ждавшее занятие закрывается, обычным порядком.
          await activatePackageTx(tx, { packageId: draft, organizationId, actorUserId: null })
          assert.equal((await entryOf(waiting)).price, 1_000, 'закрылось по цене этого пакета')
          assert.equal((await wallet(s.to)).lessonsBalance, 8)
          assert.equal((await wallet(s.from)).lessonsBalance, 0)
          ok('черновик меняет только владельца и ничего не гасит до оплаты')
        }

        // ─── Отказы ────────────────────────────────────────────────────
        console.log('\nОтказы')

        {
          const s = await scene('Отменённый')
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 4_000,
            lessonCount: 4,
          })
          await cancelPackageTx(tx, {
            packageId: p,
            organizationId,
            actorUserId: null,
            effectiveAt: TODAY,
          })
          await assert.rejects(() => move([p], s.to), ConflictError)
          assert.equal((await packet(p)).walletId, s.from, 'и пакет остался на месте')
          ok('отменённый пакет перенести нельзя')
        }

        {
          const mine = await scene('Свой')
          const other = await scene('Чужой')
          const p = await pay({
            walletId: mine.from,
            studentId: mine.studentId,
            date: '2026-09-01',
            price: 4_000,
            lessonCount: 4,
          })
          await assert.rejects(() => move([p], other.to), ConflictError)
          assert.equal((await packet(p)).walletId, mine.from)
          ok('на кошелёк другого ученика — нельзя')
        }

        {
          const s = await scene('Архивный получатель')
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 4_000,
            lessonCount: 4,
          })
          await tx.wallet.update({ where: { id: s.to }, data: { status: 'ARCHIVED' } })
          await assert.rejects(() => move([p], s.to), ConflictError)
          ok('на архивный кошелёк — нельзя')
        }

        {
          const s = await scene('Тот же')
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 4_000,
            lessonCount: 4,
          })
          await assert.rejects(() => move([p], s.from), ConflictError)
          ok('на тот же кошелёк — нельзя')
        }

        {
          const s = await scene('Чужая школа')
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 4_000,
            lessonCount: 4,
          })
          await assert.rejects(
            () =>
              transferPackagesTx(tx, {
                packageIds: [p],
                toWalletId: s.to,
                organizationId: -1,
                actorUserId: null,
                effectiveAt: TODAY,
              }),
            NotFoundError,
          )
          assert.equal((await packet(p)).walletId, s.from, 'чужой запрос ничего не сдвинул')
          ok('изоляция: пакет чужой школы не переносится')
        }

        {
          const s = await scene('Разные кошельки')
          const a = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 4_000,
            lessonCount: 4,
          })
          const b = await pay({
            walletId: s.to,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 4_000,
            lessonCount: 4,
          })
          await assert.rejects(() => move([a, b], s.to), ConflictError)
          ok('пакеты с разных кошельков одной операцией — нельзя')
        }

        // ─── Архивный источник ─────────────────────────────────────────
        console.log('\nАрхивный источник')

        {
          const s = await scene('Из архива')
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 5_000,
            lessonCount: 5,
          })
          await tx.wallet.update({ where: { id: s.from }, data: { status: 'ARCHIVED' } })

          await move([p], s.to)
          assert.equal((await wallet(s.from)).lessonsBalance, 0)
          assert.equal((await wallet(s.to)).lessonsBalance, 5)
          ok('остаток вытаскивается из заархивированного кошелька')
        }

        // ─── Что происходит с занятиями после переноса ─────────────────
        console.log('\nЗанятия после переноса')

        {
          const s = await scene('Откат')
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 10_000,
            lessonCount: 10,
          })
          const v = await visit({ studentId: s.studentId })
          await mark(v, AttendanceStatus.PRESENT)
          await move([p], s.to)

          const charge = await tx.walletEntry.findFirstOrThrow({
            where: { attendanceId: v, kind: WalletEntryKind.CHARGE },
            select: { id: true, walletId: true },
          })
          assert.equal(charge.walletId, s.from, 'списание осталось там, где случилось')

          await mark(v, AttendanceStatus.UNSPECIFIED)

          assert.equal((await wallet(s.from)).lessonsBalance, 0, 'источнику урок не вернулся')
          assert.equal((await wallet(s.to)).lessonsBalance, 10, 'он ушёл туда, где лежит пакет')
          assert.equal((await packet(p)).remaining, 10)

          const reversal = await tx.walletEntry.findFirstOrThrow({
            where: { attendanceId: v, kind: WalletEntryKind.REVERSAL },
            select: { walletId: true, reversalOfId: true },
          })
          assert.equal(reversal.walletId, s.to)
          assert.equal(
            reversal.reversalOfId,
            charge.id,
            'откат ссылается на своё списание, даже лежащее на другом кошельке',
          )
          ok('откат после переноса возвращает урок получателю')
        }

        {
          const s = await scene('Отмена после переноса')
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 6_000,
            lessonCount: 6,
          })
          const before = await wallet(s.to)
          await move([p], s.to)
          await cancelPackageTx(tx, {
            packageId: p,
            organizationId,
            actorUserId: null,
            effectiveAt: TODAY,
          })

          assert.deepEqual(await wallet(s.to), before, 'счётчики получателя вернулись как были')
          assert.equal((await packet(p)).remaining, 0)
          ok('отмена после переноса снимает остаток с получателя')
        }

        // ─── Очередь ───────────────────────────────────────────────────
        console.log('\nОчередь и цена')

        {
          const s = await scene('Старше головы', groupTwo.id)
          // У получателя свой пакет нового года, к нему же привязана группа.
          await tx.studentGroup.updateMany({
            where: { studentId: s.studentId },
            data: { walletId: s.to },
          })
          await pay({
            walletId: s.to,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 12_000,
            lessonCount: 10,
          }) // 1200
          const old = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2025-09-01',
            price: 2_000,
            lessonCount: 2,
          }) // 1000

          await move([old], s.to)

          for (const expected of [1_000, 1_000, 1_200]) {
            const v = await visit({ studentId: s.studentId, groupId: groupTwo.id })
            await mark(v, AttendanceStatus.PRESENT)
            assert.equal(
              (await entryOf(v)).price,
              expected,
              'цену задаёт голова очереди по дате продажи',
            )
          }
          ok('перенесённый пакет старше — он и задаёт цену, пока не кончится')
        }

        // ─── Гашение ждавших оплаты ────────────────────────────────────
        console.log('\nГашение')

        {
          const s = await scene('Ждали оплаты')
          // Занятия у получателя: группа привязана к нему, пакетов нет.
          await tx.studentGroup.updateMany({
            where: { studentId: s.studentId },
            data: { walletId: s.to },
          })
          const waiting = []
          for (let i = 0; i < 3; i += 1) {
            const v = await visit({ studentId: s.studentId })
            await mark(v, AttendanceStatus.PRESENT)
            assert.equal((await entryOf(v)).price, null, 'платить нечем — занятие ждёт')
            waiting.push(v)
          }

          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 4_000,
            lessonCount: 4,
          })
          const result = await move([p], s.to)

          assert.equal(result.settled, 3, 'перенос закрыл всё, что ждало')
          for (const v of waiting) {
            assert.equal((await entryOf(v)).price, 1_000)
          }
          assert.equal((await wallet(s.to)).lessonsBalance, 1)
          ok('перенос гасит занятия получателя, ждавшие оплаты')
        }

        {
          const s = await scene('Два пакета')
          await tx.studentGroup.updateMany({
            where: { studentId: s.studentId },
            data: { walletId: s.to },
          })
          const v = await visit({ studentId: s.studentId })
          await mark(v, AttendanceStatus.PRESENT)

          const a = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 2_000,
            lessonCount: 2,
          })
          const b = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-10-01',
            price: 6_000,
            lessonCount: 6,
          })

          const historyBefore = await tx.studentLessonsBalanceHistory.count({
            where: { studentId: s.studentId, reason: 'WALLET_TRANSFER' },
          })
          const result = await move([a, b], s.to)
          const historyAfter = await tx.studentLessonsBalanceHistory.count({
            where: { studentId: s.studentId, reason: 'WALLET_TRANSFER' },
          })

          assert.equal(result.packages, 2)
          assert.equal(result.moved, 8)
          assert.equal(result.settled, 1, 'гашение отработало один раз')
          assert.equal(
            historyAfter - historyBefore,
            6,
            'одна сводная запись на операцию: три поля на каждом из двух кошельков',
          )
          assert.equal((await wallet(s.to)).lessonsBalance, 7)
          ok('несколько пакетов за раз: одно гашение и одна запись в историю')
        }

        // ─── Чего перенос не делает ────────────────────────────────────
        console.log('\nГраницы')

        {
          const s = await scene('Группы на месте')
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 4_000,
            lessonCount: 4,
          })
          const oneOff = await visit({ studentId: s.studentId, walletId: s.from })

          await move([p], s.to)

          const links = await tx.studentGroup.findMany({
            where: { studentId: s.studentId },
            select: { walletId: true },
          })
          assert.ok(
            links.every((l) => l.walletId === s.from),
            'группы остаются на источнике: перепривязка — отдельный шаг',
          )
          assert.equal(
            (
              await tx.attendance.findUniqueOrThrow({
                where: { id: oneOff },
                select: { walletId: true },
              })
            ).walletId,
            s.from,
            'разовое посещение тоже не трогается',
          )

          // Следствие, ради которого интерфейс предупреждает.
          const next = await visit({ studentId: s.studentId })
          await mark(next, AttendanceStatus.PRESENT)
          assert.equal(
            (await entryOf(next)).price,
            null,
            'занятия группы источника ждут оплаты — это и есть цена решения',
          )
          ok('перенос не перепривязывает группы, и занятия источника повисают')
        }

        {
          const s = await scene('Отходил курс')
          await tx.studentGroup.updateMany({
            where: { studentId: s.studentId },
            data: { status: 'COMPLETED' },
          })
          const p = await pay({
            walletId: s.from,
            studentId: s.studentId,
            date: '2026-09-01',
            price: 3_000,
            lessonCount: 3,
          })
          await move([p], s.to)

          assert.equal((await wallet(s.to)).lessonsBalance, 3)
          const unpaid = await tx.attendance.count({
            where: { studentId: s.studentId, price: null, packageId: null },
          })
          assert.equal(unpaid, 0, 'занятий в ожидании оплаты не появилось')
          ok('хвост за отхоженный курс переезжает без последствий')
        }

        // ─── Свод ──────────────────────────────────────────────────────
        console.log('\nСвод')

        const wallets = await tx.wallet.findMany({
          where: { student: { lastName: LAST_NAME } },
          select: { id: true, lessonsBalance: true, totalLessons: true, totalPayments: true },
        })
        for (const w of wallets) {
          assert.equal(
            await ledgerSumOf(w.id),
            w.lessonsBalance,
            `кошелёк ${w.id}: Σ журнала ≠ баланс`,
          )
          assert.ok(w.lessonsBalance >= 0, `кошелёк ${w.id} ушёл в минус`)
          assert.ok(w.totalLessons >= 0, `кошелёк ${w.id}: totalLessons в минусе`)
          assert.ok(w.totalPayments >= 0, `кошелёк ${w.id}: totalPayments в минусе`)

          const [row] = await tx.$queryRaw<{ sum: bigint | null }[]>`
            SELECT COALESCE(SUM(p.remaining), 0)::bigint AS sum
            FROM "Package" p WHERE p."walletId" = ${w.id} AND p.status = 'ACTIVE'`
          assert.equal(
            Number(row?.sum ?? 0),
            w.lessonsBalance,
            `кошелёк ${w.id}: баланс ≠ Σ остатков пакетов`,
          )
        }
        ok(`у всех ${wallets.length} кошельков баланс = Σ журнала = Σ остатков`)

        const packets = await tx.package.findMany({
          where: { student: { lastName: LAST_NAME }, status: { not: 'PENDING' } },
          select: { id: true, remaining: true },
        })
        for (const p of packets) {
          const sum = await tx.walletEntry.aggregate({
            where: { packageId: p.id },
            _sum: { quantity: true },
          })
          assert.equal(sum._sum.quantity ?? 0, p.remaining, `пакет ${p.id}: Σ журнала ≠ остаток`)
        }
        ok(`Σ журнала = остаток у всех ${packets.length} пакетов`)

        throw new Rollback()
      },
      { timeout: 120_000 },
    )
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  const leftovers = await prisma.student.count({ where: { lastName: LAST_NAME } })
  assert.equal(leftovers, 0, 'транзакция должна была откатиться')

  console.log(`\nПеренос: ${passed} проверок прошло, база не изменилась.`)
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
