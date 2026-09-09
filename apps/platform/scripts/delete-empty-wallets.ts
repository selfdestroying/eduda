/**
 * Сносит пустые кошельки — те, на которые не ссылается ничего: ни пакета, ни строки
 * журнала, ни записи в группу, ни посещения, ни истории баланса. Денег в таких нет
 * по определению, поэтому удаление ничего не переписывает.
 *
 * Появились они из формы «Добавить в группу» на карточке ученика: кошелёк заводился
 * до записи в группу, отдельным запросом, и повторный клик успевал завести ещё один,
 * пока запись падала на составном ключе. Форма починена — скрипт убирает следы.
 *
 * Вхолостую по умолчанию, пишет только с `--apply`. Без `--student` смотрит всю базу.
 *
 *   pnpm --filter platform exec tsx scripts/delete-empty-wallets.ts --student 1086
 *   pnpm --filter platform exec tsx scripts/delete-empty-wallets.ts --student 1086 --apply
 */
import './load-env'

import { prisma } from '@repo/db'

const apply = process.argv.includes('--apply')
const studentArg = process.argv.indexOf('--student')
const studentId = studentArg === -1 ? null : Number(process.argv[studentArg + 1])

/** Пустой — значит ни одна из пяти таблиц со ссылкой на кошелёк его не знает. */
async function findEmpty(tx: typeof prisma, ids: number[] | null) {
  return await tx.wallet.findMany({
    where: {
      ...(ids ? { id: { in: ids } } : {}),
      ...(studentId ? { studentId } : {}),
      packages: { none: {} },
      ledger: { none: {} },
      studentGroups: { none: {} },
      attendances: { none: {} },
      balanceHistory: { none: {} },
    },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      organizationId: true,
      lessonsBalance: true,
      totalLessons: true,
      totalPayments: true,
      student: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
}

async function main() {
  const found = await findEmpty(prisma, null)
  console.log(`Пустых кошельков${studentId ? ` у ученика #${studentId}` : ''}: ${found.length}`)
  for (const w of found) {
    console.log(
      `  #${w.id} орг${w.organizationId} ${w.createdAt.toISOString()} ${w.status} ` +
        `name=${JSON.stringify(w.name)} bal=${w.lessonsBalance} tl=${w.totalLessons} tp=${w.totalPayments}` +
        ` — #${w.student.id} ${w.student.lastName} ${w.student.firstName}`,
    )
  }
  if (!found.length) return

  if (!apply) {
    console.log('\nПрогон вхолостую. Записать — тот же вызов с --apply.')
    return
  }

  // Перепроверка внутри транзакции: между выборкой и удалением менеджер мог
  // привязать к кошельку группу или завести оплату.
  const deleted = await prisma.$transaction(async (tx) => {
    const still = await findEmpty(
      tx as typeof prisma,
      found.map((w) => w.id),
    )
    const ids = still.map((w) => w.id)
    const skipped = found.filter((w) => !ids.includes(w.id))
    if (skipped.length) {
      console.log(`Пропущены — успели наполниться: ${skipped.map((w) => `#${w.id}`).join(', ')}`)
    }
    const { count } = await tx.wallet.deleteMany({ where: { id: { in: ids } } })
    return count
  })

  console.log(`\nУдалено кошельков: ${deleted}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
