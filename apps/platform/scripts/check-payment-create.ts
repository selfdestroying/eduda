/**
 * Проверка продажи: `createPaymentWithPackageTx` — единственное место, где счёт и
 * пакет заводятся парой, и зовут его трое (форма менеджера, разбор неразобранной
 * оплаты, опрос amoCRM). Ошибка здесь ломает деньги сразу во всех трёх.
 *
 * Всё внутри одной транзакции, которая в конце откатывается: временные школа,
 * ученик, кошелёк и оплаты в базе не остаются. Проверяется настоящая функция
 * против настоящей БД — половина инвариантов держится на `where` по школе и на
 * поведении `activatePackageTx`, то есть как раз на том, что мок бы и не проверил.
 *
 *   pnpm --filter platform exec tsx scripts/check-payment-create.ts
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import { createPaymentWithPackageTx } from '../src/features/finances/payments/create.server'
import { ConflictError, NotFoundError } from '../src/lib/error'

class Rollback extends Error {}

let passed = 0
const ok = (name: string) => {
  passed += 1
  console.log(`  ✓ ${name}`)
}

async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true } })
  if (!org) throw new Error('В базе нет ни одной организации — проверять не на чем')
  const organizationId = org.id

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { organizationId, name: 'Абонемент 8 занятий', price: 6400, lessonCount: 8 },
        select: { id: true },
      })

      const student = await tx.student.create({
        data: { organizationId, firstName: 'Проверка', lastName: 'Продажи' },
        select: { id: true },
      })
      const wallet = await tx.wallet.create({
        data: { organizationId, studentId: student.id },
        select: { id: true },
      })

      const base = {
        organizationId,
        studentId: student.id,
        walletId: wallet.id,
        productId: product.id,
        lessonCount: 8,
        date: '2026-08-29',
        actorUserId: null,
      }

      // ─── Счёт не оплачен: уроки не выданы ──────────────────────────────
      const pending = await createPaymentWithPackageTx(tx, {
        ...base,
        price: 6400,
        received: false,
      })
      assert.deepEqual(
        await tx.package.findUniqueOrThrow({
          where: { id: pending.packageId },
          select: { status: true, paymentId: true, remaining: true },
        }),
        { status: 'PENDING', paymentId: pending.paymentId, remaining: 8 },
        'пакет неоплаченного счёта обязан лежать PENDING и ссылаться на свой счёт',
      )
      assert.equal(
        (await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).lessonsBalance,
        0,
        'неоплаченный счёт не должен двигать баланс кошелька',
      )
      assert.equal(
        await tx.walletEntry.count({ where: { packageId: pending.packageId } }),
        0,
        'неоплаченный счёт не должен писать в журнал',
      )
      ok('счёт без денег не выдаёт уроки')

      // ─── Деньги получены: уроки на балансе, приход в журнале ───────────
      // 1000 ₽ за 8 занятий — цена урока делится с остатком (125 ровно), поэтому
      // берём 999: округление вниз обязано быть видно.
      const active = await createPaymentWithPackageTx(tx, {
        ...base,
        price: 999,
        received: true,
        externalId: 4242,
      })
      assert.deepEqual(
        await tx.package.findUniqueOrThrow({
          where: { id: active.packageId },
          select: { status: true, unitPrice: true, price: true, productName: true },
        }),
        { status: 'ACTIVE', unitPrice: 124, price: 999, productName: 'Абонемент 8 занятий' },
        'цена урока округляется вниз, а название пакета читается из справочника',
      )
      assert.equal(
        (await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).lessonsBalance,
        8,
        'выданный пакет обязан положить уроки на баланс',
      )
      assert.deepEqual(
        await tx.walletEntry.findFirstOrThrow({
          where: { packageId: active.packageId },
          select: { kind: true, quantity: true, unitPrice: true, effectiveAt: true },
        }),
        { kind: 'PURCHASE', quantity: 8, unitPrice: 124, effectiveAt: '2026-08-29' },
        'приход в журнале датируется бизнес-днём оплаты и несёт цену урока',
      )
      ok('оплаченный счёт выдаёт уроки и пишет приход')

      // ─── Внешний ключ доезжает ─────────────────────────────────────────
      assert.equal(
        (await tx.payment.findUniqueOrThrow({ where: { id: active.paymentId } })).externalId,
        4242,
        'без externalId опрос CRM заведёт тот же счёт второй раз',
      )
      ok('номер счёта во внешней системе сохраняется')

      // ─── Изоляция по школе ─────────────────────────────────────────────
      // Соседа заводим свою: на пустой базе его может не быть вовсе, и проверка
      // тихо превратилась бы в проверку ничего.
      const other = await tx.organization.create({
        data: { name: 'Чужая школа (проверка продажи)', slug: `check-sale-${Date.now()}` },
        select: { id: true },
      })
      const foreignStudent = await tx.student.create({
        data: { organizationId: other.id, firstName: 'Чужой', lastName: 'Ученик' },
        select: { id: true },
      })
      const foreignWallet = await tx.wallet.create({
        data: { organizationId: other.id, studentId: foreignStudent.id },
        select: { id: true },
      })

      await assert.rejects(
        () =>
          createPaymentWithPackageTx(tx, {
            ...base,
            walletId: foreignWallet.id,
            price: 6400,
            received: true,
          }),
        NotFoundError,
        'кошелёк чужой школы не должен находиться',
      )
      ok('чужой кошелёк не находится')

      // ─── Кошелёк чужого ученика ────────────────────────────────────────
      const sibling = await tx.student.create({
        data: { organizationId, firstName: 'Другой', lastName: 'Ученик' },
        select: { id: true },
      })
      const siblingWallet = await tx.wallet.create({
        data: { organizationId, studentId: sibling.id },
        select: { id: true },
      })
      await assert.rejects(
        () =>
          createPaymentWithPackageTx(tx, {
            ...base,
            walletId: siblingWallet.id,
            price: 6400,
            received: true,
          }),
        ConflictError,
        'пакет не должен ложиться в кошелёк другого ученика',
      )
      ok('кошелёк другого ученика отвергается')

      // ─── Архивный кошелёк ──────────────────────────────────────────────
      await tx.wallet.update({ where: { id: wallet.id }, data: { status: 'ARCHIVED' } })
      await assert.rejects(
        () => createPaymentWithPackageTx(tx, { ...base, price: 6400, received: true }),
        ConflictError,
        'архивный кошелёк из интерфейса не выбрать, но запросом — можно',
      )
      ok('архивный кошелёк отвергается')

      throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  console.log(`\nПродажа: ${passed} проверок прошло, база не изменилась.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
