/**
 * Разовый шаг перехода на учёт неоплаченных занятий.
 *
 * До перехода занятие без пакета списывалось «в долг» и уводило баланс кошелька в
 * минус. Новая модель минуса не знает: занятие без пакета просто не списывается.
 * Пока старые минусы висят, баланс кошелька не сходится с остатками его пакетов —
 * и сверка `check-wallet-balance.ts` будет краснеть вечно.
 *
 * Поэтому каждому кошельку с отрицательным балансом пишем строку журнала
 * `ADJUSTMENT` на день перехода и ставим баланс в ноль. Строки посещаемости не
 * трогаем: те уроки уже оценены и уже посчитаны в выручке прошлых месяцев, а долг
 * в рублях виден в отчёте «Авансы».
 *
 * Запускать ПОСЛЕ деплоя нового ядра — иначе между правкой и деплоем набежит
 * новый минус.
 *
 *   pnpm --filter platform exec tsx scripts/close-negative-balances.ts          # вхолостую
 *   pnpm --filter platform exec tsx scripts/close-negative-balances.ts --apply  # записать
 */
import './load-env'

import { prisma } from '@repo/db'
import { LEDGER_SWITCH_COMMENT } from '../src/features/finances/ledger.server'

const apply = process.argv.includes('--apply')
/** День перехода: сальдо датируем им, а не задним числом. */
const TODAY = new Date().toISOString().slice(0, 10)

async function main() {
  const wallets = await prisma.wallet.findMany({
    where: { lessonsBalance: { lt: 0 } },
    select: {
      id: true,
      organizationId: true,
      studentId: true,
      lessonsBalance: true,
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { lessonsBalance: 'asc' },
  })

  const total = wallets.reduce((sum, w) => sum + Math.abs(w.lessonsBalance), 0)
  console.log(`Кошельков с отрицательным балансом: ${wallets.length} (на ${total} ур.)`)
  for (const w of wallets.slice(0, 10)) {
    console.log(
      `  ${w.student.lastName} ${w.student.firstName} · кошелёк ${w.id}: ${w.lessonsBalance}`,
    )
  }
  if (wallets.length > 10) console.log(`  … и ещё ${wallets.length - 10}`)

  if (!apply) {
    console.log('\nПрогон вхолостую. Записать: --apply')
    await prisma.$disconnect()
    return
  }

  for (const w of wallets) {
    await prisma.$transaction(async (tx) => {
      await tx.walletEntry.create({
        data: {
          organizationId: w.organizationId,
          walletId: w.id,
          studentId: w.studentId,
          kind: 'ADJUSTMENT',
          quantity: -w.lessonsBalance,
          unitPrice: 0,
          effectiveAt: TODAY,
          comment: LEDGER_SWITCH_COMMENT,
        },
      })
      await tx.wallet.update({ where: { id: w.id }, data: { lessonsBalance: 0 } })
    })
  }

  console.log(`\nОбнулено кошельков: ${wallets.length}`)
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
