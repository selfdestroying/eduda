/**
 * Разовый шаг: списать отработки, которые ученик пропустил, предупредив.
 *
 * Правило отработок стало таким: пришёл — занятие списывается, не пришёл —
 * списывается тоже, как за пропуск без предупреждения. До этого «не пришёл»
 * различалось по флагу предупреждения, и отработки с колокольчиком остались без
 * цены: занятие школа провела, а денег за него в базе нет.
 *
 * Скрипт догоняет ровно их — обычным списанием (`chargeAttendanceTx`), а не
 * правкой колонок: урок гасит головной пакет кошелька, цена берётся оттуда,
 * строка журнала датируется днём занятия. Ничего нового по сравнению с тем, что
 * сделала бы отметка посещаемости сегодня.
 *
 * Кошелька или свободного пакета нет — занятие остаётся ждать оплаты, как любое
 * другое непокрытое: цену ему скажет следующая оплата (`settleUnpaidAttendancesTx`).
 * Скрипт идемпотентен: строка с ценой второй раз не списывается.
 *
 * Прогон вхолостую делает всё то же самое в транзакции и откатывает её — цифры в
 * сводке настоящие, а не оценка.
 *
 *   pnpm --filter platform exec tsx scripts/charge-missed-makeups.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/charge-missed-makeups.ts --apply  # записать
 */
import './load-env'

import { prisma } from '@repo/db'
import { chargeAttendanceTx } from '../src/features/finances/ledger.server'

const APPLY = process.argv.includes('--apply')

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

class Rollback extends Error {}

async function main() {
  const candidates = await prisma.attendance.findMany({
    where: {
      status: 'ABSENT',
      makeupForAttendanceId: { not: null },
      isTrial: false,
      price: null,
      packageId: null,
      lesson: { status: 'ACTIVE' },
    },
    // От старого занятия к новому: гасим в том же порядке, что и очередь пакетов.
    orderBy: [{ lesson: { date: 'asc' } }, { id: 'asc' }],
    select: {
      id: true,
      organizationId: true,
      organization: { select: { name: true } },
      student: { select: { firstName: true, lastName: true } },
      lesson: { select: { date: true } },
    },
  })

  const line = '─'.repeat(64)
  console.info(`Списание пропущенных отработок — ${APPLY ? 'ЗАПИСЬ' : 'вхолостую'}`)
  console.info(line)

  if (candidates.length === 0) {
    console.info('Неоплаченных пропущенных отработок нет')
    return
  }

  const charged: { org: string; ym: string; price: number }[] = []

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const a of candidates) {
          await chargeAttendanceTx(tx, {
            attendanceId: a.id,
            organizationId: a.organizationId,
            actorUserId: null,
            meta: { chargedBy: 'charge-missed-makeups' },
          })
          // Пакета под занятие могло не найтись — тогда оно осталось ждать оплаты.
          const after = await tx.attendance.findUniqueOrThrow({
            where: { id: a.id },
            select: { price: true },
          })
          if (after.price === null) continue
          charged.push({
            org: a.organization.name,
            ym: a.lesson.date.slice(0, 7),
            price: after.price,
          })
        }

        if (!APPLY) throw new Rollback()
      },
      { timeout: 120_000 },
    )
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  const money = charged.reduce((sum, r) => sum + r.price, 0)
  console.info(
    `Отработок без цены: ${candidates.length}, из них спишется ${charged.length} на ${rub(money)}`,
  )

  const tally = (key: (r: (typeof charged)[number]) => string) => {
    const acc = new Map<string, { n: number; money: number }>()
    for (const r of charged) {
      const bucket = acc.get(key(r)) ?? { n: 0, money: 0 }
      bucket.n += 1
      bucket.money += r.price
      acc.set(key(r), bucket)
    }
    return [...acc]
  }

  if (charged.length > 0) {
    console.info(line)
    console.info('По школам:')
    for (const [org, { n, money: m }] of tally((r) => r.org).sort((a, b) => b[1].n - a[1].n)) {
      console.info(`  ${org.padEnd(22)} ${String(n).padStart(4)}  ${rub(m)}`)
    }
    console.info(line)
    console.info('По месяцам:')
    for (const [ym, { n, money: m }] of tally((r) => r.ym).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      console.info(`  ${ym}  ${String(n).padStart(4)} зан.  ${rub(m)}`)
    }
  }

  const waiting = candidates.length - charged.length
  if (waiting > 0) {
    console.info(line)
    console.info(`Останутся ждать оплаты: ${waiting} (нет кошелька или свободного пакета)`)
  }

  if (!APPLY) {
    console.info('\nПрогон вхолостую, транзакция откачена. Записать: --apply')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
