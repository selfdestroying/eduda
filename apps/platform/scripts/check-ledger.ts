/**
 * Сверка журнала с колонками, которые он объясняет.
 *
 *   Σ quantity по кошельку = Wallet.lessonsBalance
 *   Σ quantity по пакету   = Payment.remaining
 *   Σ quantity × unitPrice по списаниям = выручка, которую показывает отчёт
 *
 * Колонки — кеш поверх журнала. Если они разошлись, правда в журнале, а кеш
 * пересобирается; поэтому расхождение здесь — это баг в коде, а не в данных.
 *
 *   pnpm --filter platform exec tsx scripts/check-ledger.ts
 */
import './load-env'

import { prisma } from '@repo/db'
import { UNPAID_ATTENDANCE_WHERE } from '../src/features/finances/chargeable.server'

import { LEDGER_SWITCH_COMMENT } from '../src/features/finances/ledger.server'

type Row = { id: number; expected: number; actual: number }

const fmt = (n: number) => n.toLocaleString('ru-RU')

async function main() {
  const total = await prisma.walletEntry.count()
  if (total === 0) {
    throw new Error('Журнал пуст — сначала scripts/backfill-wallet-ledger.ts --apply')
  }

  // ─── Остаток кошелька ────────────────────────────────────────────────
  const byWallet = await prisma.walletEntry.groupBy({
    by: ['walletId'],
    _sum: { quantity: true },
  })
  const ledgerBalance = new Map(byWallet.map((r) => [r.walletId, r._sum.quantity ?? 0]))

  const wallets = await prisma.wallet.findMany({ select: { id: true, lessonsBalance: true } })
  const walletMismatches: Row[] = []
  for (const w of wallets) {
    const expected = ledgerBalance.get(w.id) ?? 0
    if (expected !== w.lessonsBalance) {
      walletMismatches.push({ id: w.id, expected, actual: w.lessonsBalance })
    }
  }

  // ─── Остаток пакета ──────────────────────────────────────────────────
  const byPacket = await prisma.walletEntry.groupBy({
    by: ['paymentId'],
    _sum: { quantity: true },
    where: { paymentId: { not: null } },
  })
  const ledgerRemaining = new Map(byPacket.map((r) => [r.paymentId!, r._sum.quantity ?? 0]))

  const payments = await prisma.payment.findMany({
    where: { walletId: { not: null } },
    select: { id: true, remaining: true },
  })
  const packetMismatches: Row[] = []
  for (const p of payments) {
    const expected = ledgerRemaining.get(p.id) ?? 0
    if (expected !== (p.remaining ?? 0)) {
      packetMismatches.push({ id: p.id, expected, actual: p.remaining ?? 0 })
    }
  }

  // ─── Выручка: журнал против строк посещаемости ───────────────────────
  // Отчёты пока читают проводки на строках; журнал обязан давать ту же цифру,
  // иначе переключать их на него нельзя.
  const [ledgerRevenue] = await prisma.$queryRaw<{ sum: bigint | null }[]>`
    SELECT SUM(-e."quantity" * e."unitPrice")::bigint AS sum
    FROM "WalletEntry" e
    WHERE e."attendanceId" IS NOT NULL
  `
  const [rowRevenue] = await prisma.$queryRaw<{ sum: bigint | null }[]>`
    SELECT SUM(a."price" * a."amount")::bigint AS sum
    FROM "Attendance" a
    WHERE a."amount" > 0
      AND EXISTS (SELECT 1 FROM "WalletEntry" e WHERE e."attendanceId" = a."id")
  `
  const ledgerMoney = Number(ledgerRevenue?.sum ?? 0)
  const rowMoney = Number(rowRevenue?.sum ?? 0)

  // ─── Парность откатов ────────────────────────────────────────────────
  const danglingReversals = await prisma.walletEntry.count({
    where: { kind: 'REVERSAL', reversalOfId: null },
  })

  // ─── Возврат к старому поведению ─────────────────────────────────────
  // Минус на балансе означает, что кто-то снова списывает без пакета.
  const negativeWallets = await prisma.wallet.count({ where: { lessonsBalance: { lt: 0 } } })

  // Списание без пакета — тоже. Ищем его по журналу, а не по строкам посещаемости:
  // у строки `updatedAt` меняется от любой правки, хоть от комментария, а строка
  // журнала пишется один раз и датируется тем, когда движение случилось.
  //
  // День перехода берём из самой ранней корректировки, которой его пометили. Пока
  // перехода не было, проверять нечего.
  const switchEntry = await prisma.walletEntry.findFirst({
    where: { kind: 'ADJUSTMENT', comment: LEDGER_SWITCH_COMMENT },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  })
  const freshDebt = switchEntry
    ? await prisma.walletEntry.count({
        where: {
          kind: 'CHARGE',
          paymentId: null,
          attendanceId: { not: null },
          createdAt: { gt: switchEntry.createdAt },
        },
      })
    : 0

  // ─── Сколько занятий ждёт оплаты ─────────────────────────────────────
  const unpaid = await prisma.attendance.count({ where: UNPAID_ATTENDANCE_WHERE })

  console.log(`Строк в журнале: ${fmt(total)}`)
  console.log(
    `Кошельков, где остаток ≠ Σ журнала: ${walletMismatches.length} из ${fmt(wallets.length)}`,
  )
  console.log(
    `Пакетов, где остаток ≠ Σ журнала: ${packetMismatches.length} из ${fmt(payments.length)}`,
  )
  console.log(`Выручка по журналу: ${fmt(ledgerMoney)} ₽`)
  console.log(`Выручка по строкам:  ${fmt(rowMoney)} ₽`)
  console.log(`Откатов без своей пары: ${danglingReversals}`)
  console.log(`Кошельков с отрицательным балансом: ${negativeWallets}`)
  console.log(`Списаний без пакета после перехода: ${freshDebt}`)
  console.log(`Занятий ждёт оплаты: ${fmt(unpaid)}`)

  for (const row of walletMismatches.slice(0, 10)) {
    console.log(`  кошелёк ${row.id}: журнал ${row.expected}, колонка ${row.actual}`)
  }
  for (const row of packetMismatches.slice(0, 10)) {
    console.log(`  пакет ${row.id}: журнал ${row.expected}, колонка ${row.actual}`)
  }

  const broken =
    walletMismatches.length > 0 ||
    packetMismatches.length > 0 ||
    ledgerMoney !== rowMoney ||
    negativeWallets > 0 ||
    freshDebt > 0

  console.log(broken ? '\nЖурнал разошёлся с колонками.' : '\nЖурнал сходится.')
  await prisma.$disconnect()
  if (broken) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
