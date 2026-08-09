/**
 * Самопроверка очереди пакетов (`applyPacketEntryTx`) — денежная логика,
 * поэтому проверяется настоящим кодом против настоящей БД.
 *
 * Всё происходит внутри одной транзакции, которая в конце откатывается: временные
 * ученик, кошелёк и платежи в базе не остаются. Мока Prisma нет намеренно —
 * порядок очереди держится на сортировке в SQL, и мок бы её как раз и не проверил.
 *
 *   pnpm --filter platform exec tsx scripts/check-payment-packets.ts
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import {
  applyPacketEntryTx,
  refundAttendanceTx,
  releasePacketEntryTx,
} from '../src/features/finances/packets.server'

class Rollback extends Error {}

const CHARGE = -1
const REVERT = +1
const NOTHING = { paymentId: null, amount: null }

async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true } })
  if (!org) throw new Error('В базе нет ни одной организации — проверять не на чем')

  try {
    await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: { firstName: 'Проверка', lastName: 'Пакетов', organizationId: org.id },
        select: { id: true },
      })
      const wallet = await tx.wallet.create({
        data: { organizationId: org.id, studentId: student.id },
        select: { id: true },
      })

      const packet = async (date: string, price: number, lessonCount: number) =>
        await tx.payment.create({
          data: {
            organizationId: org.id,
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

      const remainingOf = async (id: number) =>
        (await tx.payment.findUniqueOrThrow({ where: { id }, select: { remaining: true } }))
          .remaining

      // Пакет A дороже и куплен раньше, пакет B дешевле и куплен позже — тот самый
      // случай, в котором старая формула переписывала осень задним числом.
      const a = await packet('2026-09-01', 12_000, 12)

      // ─── Списание берёт головной пакет и его цену ──────────────────────
      const first = (
        await applyPacketEntryTx(tx, {
          walletId: wallet.id,
          delta: CHARGE,
          previous: NOTHING,
        })
      ).entry
      assert.deepEqual(
        first,
        { paymentId: a.id, price: 1000, amount: 1 },
        'первый визит должен списаться с пакета A по 1000 ₽',
      )
      assert.equal(await remainingOf(a.id), 11, 'остаток пакета A должен уменьшиться на урок')

      // ─── Более дешёвый пакет не перебивает цену, пока голова не кончилась ──
      const b = await packet('2027-01-15', 6_000, 12)
      const afterCheaper = (
        await applyPacketEntryTx(tx, {
          walletId: wallet.id,
          delta: CHARGE,
          previous: NOTHING,
        })
      ).entry
      assert.deepEqual(
        afterCheaper,
        { paymentId: a.id, price: 1000, amount: 1 },
        'визит после покупки дешёвого пакета всё ещё ест пакет A',
      )
      assert.equal(await remainingOf(b.id), 12, 'пакет B не должен трогаться, пока A не кончился')

      // ─── Откат возвращает урок в свой пакет, а не в голову очереди ─────
      const reverted = (
        await applyPacketEntryTx(tx, {
          walletId: wallet.id,
          delta: REVERT,
          previous: { paymentId: a.id, amount: 1 },
        })
      ).entry
      assert.deepEqual(reverted, { amount: 0 }, 'откат обнуляет количество в проводке')
      assert.equal(await remainingOf(a.id), 11, 'урок вернулся в пакет A')
      assert.equal(await remainingOf(b.id), 12, 'откат не должен наливать остаток в пакет B')

      // ─── Повторный откат уже откаченной строки ничего не двигает ───────
      const twice = (
        await applyPacketEntryTx(tx, {
          walletId: wallet.id,
          delta: REVERT,
          previous: { paymentId: a.id, amount: 0 },
        })
      ).entry
      assert.deepEqual(twice, { amount: 0 }, 'повторный откат безвреден: количество и так ноль')
      assert.equal(await remainingOf(a.id), 11, 'повторный откат не должен раздувать остаток')

      // ─── Пакет A выработан — очередь переходит к B ─────────────────────
      await tx.payment.update({ where: { id: a.id }, data: { remaining: 0 } })
      const fromB = (
        await applyPacketEntryTx(tx, {
          walletId: wallet.id,
          delta: CHARGE,
          previous: NOTHING,
        })
      ).entry
      assert.deepEqual(
        fromB,
        { paymentId: b.id, price: 500, amount: 1 },
        'после A очередь переходит к B с его собственной ценой',
      )

      // ─── Очередь исчерпана: списываем в долг по последней цене ─────────
      await tx.payment.update({ where: { id: b.id }, data: { remaining: 0 } })
      const credit = (
        await applyPacketEntryTx(tx, {
          walletId: wallet.id,
          delta: CHARGE,
          previous: NOTHING,
        })
      ).entry
      assert.deepEqual(
        credit,
        { paymentId: null, price: 500, amount: 1 },
        'без непотраченных пакетов урок идёт в долг по цене последнего пакета (B), а не по первому',
      )

      // ─── Долг откатывается, не трогая ничьи остатки ────────────────────
      const creditBack = (
        await applyPacketEntryTx(tx, {
          walletId: wallet.id,
          delta: REVERT,
          previous: { paymentId: null, amount: 1 },
        })
      ).entry
      assert.deepEqual(
        creditBack,
        { amount: 0 },
        'у долга нет пакета, но количество обнулить надо — иначе выручка останется',
      )
      assert.equal(await remainingOf(a.id), 0, 'откат долга не должен трогать пакет A')

      // ─── Кошелёк без единой оплаты: цена из счётчиков переезда ─────────
      const legacy = await tx.wallet.create({
        data: {
          organizationId: org.id,
          studentId: student.id,
          totalLessons: 36,
          totalPayments: 36_000,
        },
        select: { id: true },
      })
      const fromCounters = (
        await applyPacketEntryTx(tx, {
          walletId: legacy.id,
          delta: CHARGE,
          previous: NOTHING,
        })
      ).entry
      assert.deepEqual(
        fromCounters,
        { paymentId: null, price: 1000, amount: 1 },
        'без оплат цена берётся из счётчиков кошелька',
      )

      // ─── Совсем пустой кошелёк: цены нет, но и падать нельзя ───────────
      const blank = await tx.wallet.create({
        data: { organizationId: org.id, studentId: student.id },
        select: { id: true },
      })
      const unknown = (
        await applyPacketEntryTx(tx, {
          walletId: blank.id,
          delta: CHARGE,
          previous: NOTHING,
        })
      ).entry
      assert.deepEqual(
        unknown,
        { paymentId: null, price: 0, amount: 1 },
        'про кошелёк без оплат и счётчиков не известно ничего — цена ноль',
      )

      // ─── Удаление строки возвращает урок в пакет ───────────────────────
      await releasePacketEntryTx(tx, { paymentId: a.id, amount: 1 })
      assert.equal(await remainingOf(a.id), 1, 'удалённая проводка вернула урок в пакет A')
      await releasePacketEntryTx(tx, { paymentId: null, amount: 1 })
      await releasePacketEntryTx(tx, { paymentId: a.id, amount: 0 })
      assert.equal(await remainingOf(a.id), 1, 'возвращать нечего — остаток не растёт')

      // ─── Удаление строки возвращает урок и на баланс кошелька ──────────
      const balanceOf = async () =>
        (
          await tx.wallet.findUniqueOrThrow({
            where: { id: wallet.id },
            select: { lessonsBalance: true },
          })
        ).lessonsBalance
      const beforeRefund = await balanceOf()
      await refundAttendanceTx(tx, { paymentId: a.id, amount: 1 })
      assert.equal(
        await balanceOf(),
        beforeRefund + 1,
        'удалённое посещение вернуло урок на баланс',
      )
      assert.equal(await remainingOf(a.id), 2, 'и в пакет тоже')
      await refundAttendanceTx(tx, { paymentId: null, amount: 1 })
      assert.equal(await balanceOf(), beforeRefund + 1, 'у долга пакета нет — баланс не трогаем')

      // ─── Откат списания с отменённой оплаты ────────────────────────────
      await packet('2027-04-01', 4_000, 4)
      const spent = await applyPacketEntryTx(tx, {
        walletId: wallet.id,
        delta: CHARGE,
        previous: NOTHING,
      })
      const spentOn = spent.entry.paymentId!
      assert.ok(spentOn, 'списание должно было найти пакет')
      await tx.payment.update({
        where: { id: spentOn },
        data: { status: 'CANCELLED', remaining: 0 },
      })

      const afterCancel = await applyPacketEntryTx(tx, {
        walletId: wallet.id,
        delta: REVERT,
        previous: { paymentId: spentOn, amount: 1 },
      })
      assert.deepEqual(afterCancel.entry, { amount: 0 }, 'проводка снимается в любом случае')
      assert.equal(
        afterCancel.balanceDelta,
        0,
        'урок не возвращается на баланс: деньги за отменённую оплату школа вернула',
      )
      assert.equal(await remainingOf(spentOn), 0, 'и в отменённый пакет он не кладётся')

      await refundAttendanceTx(tx, { paymentId: spentOn, amount: 1 })
      assert.equal(await remainingOf(spentOn), 0, 'удаление строки тоже не оживляет отменённую')

      // ─── Группа без кошелька: ни списания, ни выручки ──────────────────
      const noWallet = (
        await applyPacketEntryTx(tx, {
          walletId: null,
          delta: CHARGE,
          previous: { paymentId: a.id, amount: 1 },
        })
      ).entry
      assert.deepEqual(
        noWallet,
        { paymentId: null, price: 0, amount: 0 },
        'без кошелька проводка обнуляется, а не остаётся от прошлого статуса',
      )

      // ─── Пакет с нулём уроков не делит на ноль ─────────────────────────
      await tx.payment.update({ where: { id: a.id }, data: { remaining: 0 } })
      const broken = await packet('2027-02-01', 5_000, 0)
      await tx.payment.update({ where: { id: broken.id }, data: { remaining: 1 } })
      const fromBroken = (
        await applyPacketEntryTx(tx, {
          walletId: wallet.id,
          delta: CHARGE,
          previous: NOTHING,
        })
      ).entry
      assert.deepEqual(
        fromBroken,
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

  console.log('Очередь пакетов: все проверки прошли, база не изменилась.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
