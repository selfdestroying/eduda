/**
 * Проверка связки «оплата — продукт»: изоляция по школе, снимок названия и то, что
 * удаление продукта переживают прошлые оплаты.
 *
 * Всё внутри одной транзакции, которая в конце откатывается: временные школа,
 * продукты и оплаты в базе не остаются. Проверяется настоящий `resolveProductTx`
 * против настоящей БД — половина инвариантов держится на `where` и на `onDelete:
 * SetNull`, то есть как раз на том, что мок бы и не проверил.
 *
 *   pnpm --filter platform exec tsx scripts/check-payment-product.ts
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import { loadPaymentProductTx } from '../src/features/finances/products/resolve.server'
import { NotFoundError } from '../src/lib/error'

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
      // Вторая школа — своя, а не найденная в базе: на пустой базе соседа может не
      // быть вовсе, и проверка изоляции тихо превратилась бы в проверку ничего.
      const other = await tx.organization.create({
        data: { name: 'Чужая школа (проверка продуктов)', slug: `check-product-${Date.now()}` },
        select: { id: true },
      })

      const mine = await tx.product.create({
        data: { organizationId, name: 'Абонемент 8 занятий', price: 6400, lessonCount: 8 },
        select: { id: true },
      })
      const foreign = await tx.product.create({
        data: {
          organizationId: other.id,
          name: 'Чужой абонемент',
          price: 9999,
          lessonCount: 9,
        },
        select: { id: true },
      })

      // ─── Свой продукт даёт ссылку и снимок названия ────────────────────
      assert.deepEqual(
        await loadPaymentProductTx(tx, mine.id, organizationId),
        { id: mine.id, name: 'Абонемент 8 занятий' },
        'название снимка должно читаться из базы, а не приходить из запроса',
      )
      ok('свой продукт даёт ссылку и название')

      // ─── Чужой продукт не прицепляется ─────────────────────────────────
      await assert.rejects(
        () => loadPaymentProductTx(tx, foreign.id, organizationId),
        NotFoundError,
        'продукт чужой школы не должен находиться',
      )
      ok('чужой продукт не находится')

      // ─── Снятый с продажи принимается ──────────────────────────────────
      await tx.product.update({ where: { id: mine.id }, data: { isActive: false } })
      assert.equal(
        (await loadPaymentProductTx(tx, mine.id, organizationId)).name,
        'Абонемент 8 занятий',
        'снятый с продажи продукт должен приниматься: разбор старой оплаты законен',
      )
      await tx.product.update({ where: { id: mine.id }, data: { isActive: true } })
      ok('снятый с продажи продукт принимается')

      // ─── Удаление продукта переживает прошлая оплата ───────────────────
      const student = await tx.student.create({
        data: { firstName: 'Проверка', lastName: 'Продуктов', organizationId },
        select: { id: true },
      })
      const wallet = await tx.wallet.create({
        data: { organizationId, studentId: student.id },
        select: { id: true },
      })
      // Оплата собирается ровно так, как её собирает экшен: продукт даёт ссылку и
      // название, а сумма приходит из формы — здесь со скидкой в 500 ₽, какую и
      // правят руками поверх прайса.
      const resolved = await loadPaymentProductTx(tx, mine.id, organizationId)
      const packet = await tx.package.create({
        data: {
          organizationId,
          studentId: student.id,
          walletId: wallet.id,
          date: '2026-09-01',
          price: 5900,
          lessonCount: 8,
          unitPrice: Math.floor(5900 / 8),
          remaining: 8,
          productId: resolved.id,
          productName: resolved.name,
        },
        select: { id: true },
      })
      assert.deepEqual(
        await tx.package.findUniqueOrThrow({
          where: { id: packet.id },
          select: { price: true, productId: true },
        }),
        { price: 5900, productId: mine.id },
        'правка суммы должна доезжать до базы, не отвязывая пакет от продукта',
      )
      ok('сумма правится поверх прайса, ссылка на продукт остаётся')

      await tx.product.delete({ where: { id: mine.id } })
      assert.deepEqual(
        await tx.package.findUniqueOrThrow({
          where: { id: packet.id },
          select: { productId: true, productName: true },
        }),
        { productId: null, productName: 'Абонемент 8 занятий' },
        'удаление продукта должно обнулять ссылку и сохранять снимок названия',
      )
      ok('удаление продукта не стирает название в пакете')

      throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  console.log(`\nСвязка «оплата — продукт»: ${passed} проверок прошло, база не изменилась.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
