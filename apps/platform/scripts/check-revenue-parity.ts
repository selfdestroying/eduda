/**
 * Сверка выручки после перевода отчётов на проводки: помесячные суммы, посчитанные
 * `computeAttendanceRevenue`, должны совпасть с прямым `SUM(price × amount)` из базы.
 *
 * Проверяет, что отчёт читает ровно то, что записано, и не теряет отработки: они
 * зарабатывают на своей дате и раньше в этот запрос не попадали вовсе.
 *
 *   pnpm --filter platform exec tsx scripts/check-revenue-parity.ts
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import { DEFAULT_CHARGEABLE_STATUSES } from '../src/features/finances/chargeable'
import { computeAttendanceRevenue } from '../src/features/finances/chargeable.server'

const START = '2025-09-01'
const END = '2026-08-31'

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } })
  let checked = 0

  for (const org of orgs) {
    const entries = await computeAttendanceRevenue({
      organizationId: org.id,
      startDate: START,
      endDate: END,
      chargeableStatuses: [...DEFAULT_CHARGEABLE_STATUSES],
    })
    const fromReport = entries.reduce((sum, e) => sum + e.visitCost, 0)

    const [direct] = await prisma.$queryRaw<{ total: bigint | null }[]>`
      SELECT SUM(a.price * a.amount)::bigint AS total
      FROM "Attendance" a
      JOIN "Lesson" l ON l.id = a."lessonId"
      WHERE a."organizationId" = ${org.id}
        AND l.status = 'ACTIVE'
        AND l.date >= ${START} AND l.date <= ${END}
        AND a.amount > 0
        AND (
          (a.status = 'PRESENT')
          OR (a.status = 'ABSENT' AND a."isWarned" IS DISTINCT FROM true)
        )`
    const fromDb = Number(direct?.total ?? 0)

    assert.equal(fromReport, fromDb, `${org.name}: отчёт ${fromReport} ≠ база ${fromDb}`)
    if (fromDb > 0) checked += 1
    console.log(`${org.name}: ${fromReport.toLocaleString('ru-RU')} ₽`)
  }

  assert.ok(checked > 0, 'ни в одной организации нет выручки — сверять нечего')

  // Пустой фильтр не должен молча возвращать всё подряд.
  const none = await computeAttendanceRevenue({
    organizationId: orgs[0]!.id,
    startDate: START,
    endDate: END,
    chargeableStatuses: [],
  })
  assert.equal(none.length, 0, 'без выбранных статусов выручки быть не должно')

  console.log('\nСверка выручки: отчёт совпадает с базой.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
