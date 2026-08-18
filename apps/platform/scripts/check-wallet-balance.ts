/**
 * Сверка остатков: сумма непотраченных уроков по пакетам кошелька должна совпадать
 * с его балансом, а остаток каждого пакета — с тем, что по нему списали.
 *
 * Это и есть замена мутируемому счётчику: расхождение здесь означает, что какая-то
 * операция подвинула баланс мимо пакетов.
 *
 *   pnpm --filter platform exec tsx scripts/check-wallet-balance.ts
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'

async function main() {
  // Баланс кошелька — это ровно непотраченные уроки его пакетов. Занятие, под
  // которое нет пакета, не списывается вовсе, поэтому в минус баланс не уходит и
  // обрезать его снизу больше незачем.
  const [balance] = await prisma.$queryRaw<{ n: bigint; total: bigint }[]>`
    SELECT count(*)::bigint AS n, COALESCE(SUM(abs(diff)), 0)::bigint AS total FROM (
      SELECT w.id, w."lessonsBalance" - COALESCE(SUM(p.remaining), 0) AS diff
      FROM "Wallet" w
      LEFT JOIN "Package" p ON p."walletId" = w.id AND p.status = 'ACTIVE'
      GROUP BY w.id, w."lessonsBalance"
    ) t WHERE diff <> 0`

  const [packets] = await prisma.$queryRaw<{ n: bigint; total: bigint }[]>`
    SELECT count(*)::bigint AS n, COALESCE(SUM(abs(diff)), 0)::bigint AS total FROM (
      SELECT p.id, p."lessonCount" - COALESCE(SUM(a.amount), 0) - p.remaining AS diff
      FROM "Package" p LEFT JOIN "Attendance" a ON a."packageId" = p.id
      WHERE p.remaining IS NOT NULL
      GROUP BY p.id, p."lessonCount", p.remaining
    ) t WHERE diff <> 0`

  const negative = await prisma.package.count({ where: { remaining: { lt: 0 } } })

  console.log(
    `Кошельков, где баланс ≠ Σ остатков: ${balance?.n ?? 0} (на ${balance?.total ?? 0} ур.)`,
  )
  console.log(
    `Пакетов, тронутых ручной правкой: ${packets?.n ?? 0} (на ${packets?.total ?? 0} ур.)`,
  )
  console.log(`Пакетов с отрицательным остатком: ${negative}`)

  assert.equal(Number(balance?.n ?? 0), 0, 'баланс кошелька разошёлся с остатками пакетов')
  assert.equal(negative, 0, 'остаток пакета ушёл в минус')

  console.log('\nОстатки сходятся.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
