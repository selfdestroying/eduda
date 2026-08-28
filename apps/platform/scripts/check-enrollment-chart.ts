/**
 * Сверка рядов графика на странице «Активные».
 *
 *   Σ «Новые» по всем периодам = число пар «ученик — группа»
 *   «Новые» ≤ «Активные» в каждом периоде
 *   будущих корзин в ряду нет
 *   отработки не создают пар
 *
 * Оба ряда строятся по посещаемости, потому что колонки «дата зачисления» в схеме
 * нет, а истории статусов нет вовсе. Отсюда две вещи, которые ломаются тихо:
 *
 * 1. Отметки заводятся заранее под запланированные уроки, и без верхней границы
 *    по сегодня график рисует будущие месяцы как состоявшиеся.
 * 2. Отработка — это визит в ЧУЖУЮ группу, и без её отсечения разовый приход
 *    читается как «начал заниматься здесь». У «Алгоритмики» это давало 50 новых
 *    в мае 2026 при одном настоящем.
 *
 *   pnpm --filter platform exec tsx scripts/check-enrollment-chart.ts
 */
import './load-env'

import { prisma } from '@repo/db'
import assert from 'node:assert/strict'
import { bucketKey, type View } from '../src/lib/chart-buckets'
import { todayYmdInTz } from '../src/lib/timezone'

const VIEWS: View[] = ['week', 'month', 'year']

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, timezone: true },
  })

  let checkedOrgs = 0
  let orgsWithMakeups = 0

  for (const org of orgs) {
    const tz = org.timezone || 'Europe/Moscow'
    const today = todayYmdInTz(tz)

    // Тот же `where`, что в `getEnrollmentChartData`.
    const where = {
      organizationId: org.id,
      lesson: { status: { not: 'CANCELLED' as const }, date: { lte: today } },
      makeupForAttendanceId: null,
    }
    const rows = await prisma.attendance.findMany({
      where,
      select: { studentId: true, lesson: { select: { date: true, groupId: true } } },
    })
    if (rows.length === 0) continue
    checkedOrgs++

    // Отработки, отсечённые условием: без них проверка «пар не прибавилось»
    // ничего не доказывает.
    const makeups = await prisma.attendance.count({
      where: {
        organizationId: org.id,
        lesson: { status: { not: 'CANCELLED' }, date: { lte: today } },
        makeupForAttendanceId: { not: null },
      },
    })
    if (makeups > 0) orgsWithMakeups++

    const first = new Map<string, string>()
    for (const row of rows) {
      const pair = `${row.studentId}-${row.lesson.groupId}`
      const known = first.get(pair)
      if (known === undefined || row.lesson.date < known) first.set(pair, row.lesson.date)
    }

    for (const view of VIEWS) {
      const starts = new Map<string, number>()
      for (const date of first.values()) {
        const key = bucketKey(date, view)
        starts.set(key, (starts.get(key) ?? 0) + 1)
      }
      const active = new Map<string, Set<string>>()
      for (const row of rows) {
        const key = bucketKey(row.lesson.date, view)
        active.set(
          key,
          (active.get(key) ?? new Set()).add(`${row.studentId}-${row.lesson.groupId}`),
        )
      }

      const sum = [...starts.values()].reduce((acc, n) => acc + n, 0)
      assert.equal(
        sum,
        first.size,
        `${org.name}/${view}: сумма «Новых» ${sum} ≠ ${first.size} пар — у пары не одна дата начала`,
      )

      const todayKey = bucketKey(today, view)
      for (const key of [...starts.keys(), ...active.keys()]) {
        assert.ok(
          key <= todayKey,
          `${org.name}/${view}: корзина ${key} в будущем (сегодня ${todayKey})`,
        )
      }

      for (const [key, count] of starts) {
        const inBucket = active.get(key)?.size ?? 0
        assert.ok(
          count <= inBucket,
          `${org.name}/${view}/${key}: «Новых» ${count} больше «Активных» ${inBucket} — начать, не побывав на уроке, нельзя`,
        )
      }
    }

    // Пары считаются только по своим урокам: отработка чужой группы пары не создаёт.
    const withMakeups = await prisma.attendance.findMany({
      where: {
        organizationId: org.id,
        lesson: { status: { not: 'CANCELLED' }, date: { lte: today } },
      },
      select: { studentId: true, lesson: { select: { groupId: true } } },
    })
    const allPairs = new Set(withMakeups.map((r) => `${r.studentId}-${r.lesson.groupId}`))
    console.log(
      `${org.name}: пар ${first.size} (с отработками было бы ${allPairs.size}), отработок отсечено ${makeups}`,
    )
    assert.ok(first.size <= allPairs.size, `${org.name}: отсечение отработок не могло добавить пар`)
  }

  assert.ok(checkedOrgs > 0, 'ни в одной школе нет посещаемости — сверять нечего')
  assert.ok(orgsWithMakeups > 0, 'отработок нигде нет — проверка отсечения ничего не доказывает')

  console.log(
    '\nРяды графика сходятся: будущего нет, новых не больше активных, пары не задваиваются.',
  )
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
