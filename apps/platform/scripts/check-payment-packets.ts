/**
 * Самопроверка денежного ядра (`chargeAttendanceTx` / `unchargeAttendanceTx`) —
 * проверяется настоящим кодом против настоящей БД.
 *
 * Всё происходит внутри одной транзакции, которая в конце откатывается: временные
 * школа, ученик, группа и занятия в базе не остаются. Мока Prisma нет намеренно —
 * порядок очереди держится на сортировке в SQL, и мок бы её как раз и не проверил.
 *
 *   pnpm --filter platform exec tsx scripts/check-payment-packets.ts
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import { chargeAttendanceTx, unchargeAttendanceTx } from '../src/features/finances/packets.server'

class Rollback extends Error {}

async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true } })
  if (!org) throw new Error('В базе нет ни одной организации — проверять не на чем')
  const organizationId = org.id

  try {
    await prisma.$transaction(async (tx) => {
      // ─── Декорации: школа, группа, ученик, кошелёк ─────────────────────
      const course = await tx.course.create({
        data: { organizationId, name: 'Проверка пакетов' },
        select: { id: true },
      })
      const location = await tx.location.create({
        data: { organizationId, name: 'Проверка пакетов' },
        select: { id: true },
      })
      const group = await tx.group.create({
        data: {
          organizationId,
          courseId: course.id,
          locationId: location.id,
          name: 'Проверка пакетов',
          startDate: '2026-09-01',
          maxStudents: 10,
        },
        select: { id: true },
      })
      const student = await tx.student.create({
        data: { firstName: 'Проверка', lastName: 'Пакетов', organizationId },
        select: { id: true },
      })
      const wallet = await tx.wallet.create({
        data: { organizationId, studentId: student.id },
        select: { id: true },
      })
      await tx.studentGroup.create({
        data: {
          organizationId,
          studentId: student.id,
          groupId: group.id,
          walletId: wallet.id,
          status: 'ACTIVE',
          statusChangedAt: '2026-09-01',
        },
      })

      let day = 0
      /** Занятие + строка посещаемости: то, с чем работает денежное ядро. */
      const visit = async (opts: { walletId?: number | null } = {}) => {
        day += 1
        const lesson = await tx.lesson.create({
          data: {
            organizationId,
            groupId: group.id,
            date: `2026-09-${String(day).padStart(2, '0')}`,
            time: '10:00',
          },
          select: { id: true },
        })
        const attendance = await tx.attendance.create({
          data: {
            organizationId,
            studentId: student.id,
            lessonId: lesson.id,
            status: 'PRESENT',
            walletId: opts.walletId ?? null,
          },
          select: { id: true },
        })
        return attendance.id
      }

      const packet = async (date: string, price: number, lessonCount: number) =>
        await tx.payment.create({
          data: {
            organizationId,
            studentId: student.id,
            walletId: wallet.id,
            date,
            price,
            lessonCount,
            bidForLesson: lessonCount > 0 ? Math.floor(price / lessonCount) : 0,
            remaining: lessonCount,
          },
          select: { id: true },
        })

      const entryOf = async (id: number) =>
        await tx.attendance.findUniqueOrThrow({
          where: { id },
          select: { paymentId: true, price: true, amount: true },
        })
      const remainingOf = async (id: number) =>
        (await tx.payment.findUniqueOrThrow({ where: { id }, select: { remaining: true } }))
          .remaining
      const balance = async (id = wallet.id) =>
        (await tx.wallet.findUniqueOrThrow({ where: { id }, select: { lessonsBalance: true } }))
          .lessonsBalance
      const historyCount = async () =>
        await tx.studentLessonsBalanceHistory.count({ where: { studentId: student.id } })

      const charge = (attendanceId: number) =>
        chargeAttendanceTx(tx, { attendanceId, organizationId, actorUserId: null })
      const uncharge = (attendanceId: number) =>
        unchargeAttendanceTx(tx, { attendanceId, organizationId, actorUserId: null })

      // Пакет A дороже и куплен раньше, пакет B дешевле и куплен позже — тот самый
      // случай, в котором старая формула переписывала осень задним числом.
      const a = await packet('2026-09-01', 12_000, 12)
      await tx.wallet.update({ where: { id: wallet.id }, data: { lessonsBalance: 12 } })

      // ─── Списание берёт головной пакет, его цену и двигает баланс ──────
      const first = await visit()
      await charge(first)
      assert.deepEqual(
        await entryOf(first),
        { paymentId: a.id, price: 1000, amount: 1 },
        'первый визит должен списаться с пакета A по 1000 ₽',
      )
      assert.equal(await remainingOf(a.id), 11, 'остаток пакета A должен уменьшиться на урок')
      assert.equal(await balance(), 11, 'баланс кошелька должен уменьшиться на урок')
      assert.equal(await historyCount(), 1, 'движение баланса должно попасть в историю')

      // ─── Повторное списание той же строки ничего не делает ─────────────
      await charge(first)
      assert.equal(await remainingOf(a.id), 11, 'повторное списание не должно есть пакет дважды')
      assert.equal(await balance(), 11, 'и баланс тоже')

      // ─── Чужая школа не двигает чужие деньги ───────────────────────────
      await unchargeAttendanceTx(tx, { attendanceId: first, organizationId: -1, actorUserId: null })
      assert.equal(await remainingOf(a.id), 11, 'чужая школа не должна возвращать урок в пакет')
      assert.equal(await balance(), 11, 'и трогать баланс тоже')

      // ─── Более дешёвый пакет не перебивает цену, пока голова не кончилась ──
      const b = await packet('2027-01-15', 6_000, 12)
      await tx.wallet.update({ where: { id: wallet.id }, data: { lessonsBalance: 23 } })

      const second = await visit()
      await charge(second)
      assert.deepEqual(
        await entryOf(second),
        { paymentId: a.id, price: 1000, amount: 1 },
        'визит после покупки дешёвого пакета всё ещё ест пакет A',
      )
      assert.equal(await remainingOf(b.id), 12, 'пакет B не должен трогаться, пока A не кончился')

      // ─── Откат возвращает урок в свой пакет, а не в голову очереди ─────
      const balanceBeforeRevert = await balance()
      await uncharge(second)
      assert.deepEqual(
        await entryOf(second),
        { paymentId: a.id, price: 1000, amount: 0 },
        'откат обнуляет количество, но оставляет след, чем платили',
      )
      assert.equal(await remainingOf(a.id), 11, 'урок вернулся в пакет A')
      assert.equal(await remainingOf(b.id), 12, 'откат не должен наливать остаток в пакет B')
      assert.equal(await balance(), balanceBeforeRevert + 1, 'урок вернулся и на баланс')

      // ─── Повторный откат уже откаченной строки ничего не двигает ───────
      await uncharge(second)
      assert.equal(await remainingOf(a.id), 11, 'повторный откат не должен раздувать остаток')
      assert.equal(await balance(), balanceBeforeRevert + 1, 'и баланс тоже')

      // ─── Пакет A выработан — очередь переходит к B ─────────────────────
      await tx.payment.update({ where: { id: a.id }, data: { remaining: 0 } })
      const third = await visit()
      await charge(third)
      assert.deepEqual(
        await entryOf(third),
        { paymentId: b.id, price: 500, amount: 1 },
        'после A очередь переходит к B с его собственной ценой',
      )

      // ─── Очередь исчерпана: списываем в долг по последней цене ─────────
      await tx.payment.update({ where: { id: b.id }, data: { remaining: 0 } })
      const credit = await visit()
      const balanceBeforeCredit = await balance()
      await charge(credit)
      assert.deepEqual(
        await entryOf(credit),
        { paymentId: null, price: 500, amount: 1 },
        'без непотраченных пакетов урок идёт в долг по цене последнего пакета (B), а не первого',
      )
      assert.equal(await balance(), balanceBeforeCredit - 1, 'долг тоже уходит в минус по балансу')

      // ─── Долг откатывается: и выручка, и баланс ───────────────────────
      await uncharge(credit)
      assert.deepEqual(
        await entryOf(credit),
        { paymentId: null, price: 500, amount: 0 },
        'у долга нет пакета, но количество обнулить надо — иначе выручка останется',
      )
      assert.equal(
        await balance(),
        balanceBeforeCredit,
        'урок, взятый в долг, возвращается на баланс',
      )
      assert.equal(await remainingOf(a.id), 0, 'откат долга не должен трогать чужие пакеты')

      // ─── Кошелёк без единой оплаты: цена из счётчиков переезда ─────────
      const legacy = await tx.wallet.create({
        data: { organizationId, studentId: student.id, totalLessons: 36, totalPayments: 36_000 },
        select: { id: true },
      })
      const fromCounters = await visit({ walletId: legacy.id })
      await charge(fromCounters)
      assert.deepEqual(
        await entryOf(fromCounters),
        { paymentId: null, price: 1000, amount: 1 },
        'без оплат цена берётся из счётчиков кошелька',
      )

      // ─── Совсем пустой кошелёк: цены нет, но и падать нельзя ───────────
      const blank = await tx.wallet.create({
        data: { organizationId, studentId: student.id },
        select: { id: true },
      })
      const unknown = await visit({ walletId: blank.id })
      await charge(unknown)
      assert.deepEqual(
        await entryOf(unknown),
        { paymentId: null, price: 0, amount: 1 },
        'про кошелёк без оплат и счётчиков не известно ничего — цена ноль',
      )

      // ─── Ученик без кошелька: ни списания, ни выручки ──────────────────
      const noWalletStudent = await tx.student.create({
        data: { firstName: 'Без', lastName: 'Пакетов', organizationId },
        select: { id: true },
      })
      await tx.studentGroup.create({
        data: {
          organizationId,
          studentId: noWalletStudent.id,
          groupId: group.id,
          status: 'ACTIVE',
          statusChangedAt: '2026-09-01',
        },
      })
      const orphanLesson = await tx.lesson.create({
        data: { organizationId, groupId: group.id, date: '2026-10-01', time: '10:00' },
        select: { id: true },
      })
      // Цена от прошлого статуса на строке уже есть — списание обязано её стереть.
      const orphan = await tx.attendance.create({
        data: {
          organizationId,
          studentId: noWalletStudent.id,
          lessonId: orphanLesson.id,
          status: 'PRESENT',
          paymentId: a.id,
          price: 1000,
          amount: 0,
        },
        select: { id: true },
      })
      await charge(orphan.id)
      assert.deepEqual(
        await entryOf(orphan.id),
        { paymentId: null, price: 0, amount: 0 },
        'без кошелька проводка обнуляется, а не остаётся от прошлого статуса',
      )

      // ─── Откат списания с отменённой оплаты ────────────────────────────
      const cancelled = await packet('2027-04-01', 4_000, 4)
      const spent = await visit()
      await charge(spent)
      assert.equal(
        (await entryOf(spent)).paymentId,
        cancelled.id,
        'списание должно было найти свежий пакет',
      )
      await tx.payment.update({
        where: { id: cancelled.id },
        data: { status: 'CANCELLED', remaining: 0 },
      })

      const balanceBeforeCancelRevert = await balance()
      await uncharge(spent)
      assert.equal((await entryOf(spent)).amount, 0, 'проводка снимается в любом случае')
      assert.equal(
        await balance(),
        balanceBeforeCancelRevert,
        'урок не возвращается на баланс: деньги за отменённую оплату школа вернула',
      )
      assert.equal(await remainingOf(cancelled.id), 0, 'и в отменённый пакет он не кладётся')

      // ─── Пакет с нулём уроков не делит на ноль ─────────────────────────
      const broken = await packet('2027-05-01', 5_000, 0)
      await tx.payment.update({ where: { id: broken.id }, data: { remaining: 1 } })
      const fromBroken = await visit()
      await charge(fromBroken)
      assert.deepEqual(
        await entryOf(fromBroken),
        { paymentId: broken.id, price: 0, amount: 1 },
        'пакет без уроков даёт цену 0, а не NaN и не Infinity',
      )

      throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  const leftovers = await prisma.student.count({ where: { lastName: 'Пакетов' } })
  assert.equal(leftovers, 0, 'транзакция должна была откатиться, а временный ученик — исчезнуть')

  console.log('Денежное ядро: все проверки прошли, база не изменилась.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
