/**
 * Разовый шаг перехода: закрыть нулём отработки, пропущенные при старом правиле.
 *
 * По новому правилу пропущенная отработка платная — вторая попытка одна, и не
 * прийти на неё стоит занятия (`revenue/rule.ts`). К прошлому школа применять это
 * не стала (решение 29.08.2026), и причин две, разных:
 *
 * - за исходный пропуск уже заплачено — ученик пропустил, не предупредив, с него
 *   списалось, а отработку ему дали сверху. Списать ещё и её значит взять за один
 *   прогул дважды; отработка там была подарком, а не проданным занятием;
 * - за пару не заплачено вовсе — предупредил, получил отработку, не пришёл. По
 *   новому правилу это выручка, но в тот момент родителю обещали другое.
 *
 * **Ноль, а не `null`.** Само по себе «не запускать скрипт» ничего не прощает:
 * строка без цены остаётся в `UNPAID_ATTENDANCE_WHERE`, и ближайшая оплата спишет
 * её сама — тихо, вразнобой и в тот же месяц занятия. Прощение обязано быть
 * записанным. Ноль здесь не утверждение о стоимости, а «занятие провели, денег за
 * него не взяли» — тем же нулём закрывает `close-unbillable-attendances.ts`.
 *
 * Вперёд правило работает полностью: отмеченная сегодня пропущенная отработка
 * списывается и попадает в выручку. Прощается только то, что случилось до.
 *
 * Идемпотентен: строка с ценой второй раз не берётся.
 *
 *   pnpm --filter platform exec tsx scripts/forgive-missed-makeups.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/forgive-missed-makeups.ts --apply  # записать
 */
import './load-env'

import { prisma } from '@repo/db'

const APPLY = process.argv.includes('--apply')

/** Пропущенные отработки, за которые так и не списалось. */
const WHERE = {
  status: 'ABSENT',
  makeupForAttendanceId: { not: null },
  isTrial: false,
  price: null,
  packageId: null,
  lesson: { status: 'ACTIVE' },
} as const

async function main() {
  const rows = await prisma.attendance.findMany({
    where: WHERE,
    orderBy: [{ lesson: { date: 'asc' } }, { id: 'asc' }],
    select: {
      organization: { select: { name: true } },
      student: { select: { firstName: true, lastName: true } },
      lesson: { select: { date: true } },
      // Заплачено ли за исходный пропуск: этим две причины прощения и различаются.
      makeupForAttendance: { select: { price: true } },
    },
  })

  const line = '─'.repeat(64)
  console.info(`Прощение пропущенных отработок — ${APPLY ? 'ЗАПИСЬ' : 'вхолостую'}`)
  console.info(line)

  if (rows.length === 0) {
    console.info('Незакрытых пропущенных отработок нет')
    return
  }

  const paidTwice = rows.filter((r) => r.makeupForAttendance?.price !== null).length
  console.info(
    `Занятий ${rows.length}: за ${paidTwice} исходный пропуск уже оплачен ` +
      `(иначе списали бы дважды), ${rows.length - paidTwice} не принесли ничего`,
  )

  const byOrg = new Map<string, number>()
  for (const r of rows) byOrg.set(r.organization.name, (byOrg.get(r.organization.name) ?? 0) + 1)

  console.info(line)
  console.info('По школам:')
  for (const [org, n] of [...byOrg].sort((a, b) => b[1] - a[1])) {
    console.info(`  ${org.padEnd(22)} ${String(n).padStart(4)}`)
  }

  console.info(line)
  for (const r of rows.slice(0, 15)) {
    const who = `${r.student.firstName} ${r.student.lastName}`
    const why = r.makeupForAttendance?.price !== null ? 'пропуск оплачен' : 'не оплачено ничего'
    console.info(`  ${who.padEnd(24)} ${r.lesson.date}  ${why}`)
  }
  if (rows.length > 15) console.info(`  … и ещё ${rows.length - 15}`)

  if (!APPLY) {
    console.info('\nПрогон вхолостую. Записать: --apply')
    return
  }

  const { count } = await prisma.attendance.updateMany({ where: WHERE, data: { price: 0 } })
  console.info(`\nЗакрыто нулём: ${count}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
