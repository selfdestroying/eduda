/**
 * Сверка графика отчислений с таблицей под ним.
 *
 *   Σ столбиков = число отчислений при том же отборе
 *   день отчисления заполнен и имеет вид `YYYY-MM-DD`
 *   разрез ничего не теряет: Σ по корзинам = Σ по дням, в любом виде
 *   период сужает график и список одинаково
 *
 * График и список считают одни и те же записи, но по-разному: столбик — это
 * `groupBy` по `statusChangedAt`, строка — обычная выборка. Разъезжается это
 * тихо: запись без дня выпала бы из графика, оставшись в таблице, а корзина,
 * посчитанная не из той даты, унесла бы отчисление в чужой месяц.
 *
 *   pnpm --filter platform exec tsx scripts/check-dismissed-chart.ts
 */
import './load-env'

import { prisma } from '@repo/db'
import assert from 'node:assert/strict'
import { bucketKey, type View } from '../src/lib/chart-buckets'

const VIEWS: View[] = ['week', 'month', 'year']

/** Формат date-only колонки. Ключи корзин режутся из неё префиксом. */
const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Тот же статус, что показывает страница «Отчисленные». */
const DISMISSED = 'DISMISSED' as const

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } })

  let checkedOrgs = 0
  let narrowedByPeriod = 0

  for (const org of orgs) {
    // Тот же отбор, что собирает `enrollmentWhere` для страницы: организация и
    // статус. Курс, локация, преподаватель и поиск ложатся поверх и графику с
    // таблицей достаются одинаково — сверять их по отдельности нечего.
    const where = { organizationId: org.id, status: DISMISSED }
    const total = await prisma.studentGroup.count({ where })
    if (total === 0) continue
    checkedOrgs++

    const points = await prisma.studentGroup.groupBy({
      by: ['statusChangedAt'],
      where,
      _count: { _all: true },
    })

    const sum = points.reduce((acc, point) => acc + point._count._all, 0)
    assert.equal(
      sum,
      total,
      `${org.name}: сумма столбиков ${sum} ≠ ${total} отчислений — график и список считают разное`,
    )

    for (const point of points) {
      assert.ok(
        YMD.test(point.statusChangedAt),
        `${org.name}: день отчисления «${point.statusChangedAt}» не YYYY-MM-DD — корзина посчитается не туда`,
      )
    }

    for (const view of VIEWS) {
      const buckets = new Map<string, number>()
      for (const point of points) {
        const key = bucketKey(point.statusChangedAt, view)
        buckets.set(key, (buckets.get(key) ?? 0) + point._count._all)
      }
      const bucketed = [...buckets.values()].reduce((acc, count) => acc + count, 0)
      assert.equal(
        bucketed,
        total,
        `${org.name}/${view}: в корзинах ${bucketed} из ${total} — разрез потерял отчисления`,
      )
    }

    // Период тулбара сужает график и таблицу одним и тем же сравнением строк.
    // Проверяем на настоящем месяце: равенство сумм по всей выборке про отбор
    // ничего не говорит.
    const month = points
      .map((point) => point.statusChangedAt)
      .sort()
      .at(-1)!
      .slice(0, 7)
    // Границы включительные, как у фильтра; `-31` безопасно и в коротком месяце —
    // сравнение лексикографическое.
    const inPeriod = { ...where, statusChangedAt: { gte: `${month}-01`, lte: `${month}-31` } }
    const rows = await prisma.studentGroup.count({ where: inPeriod })
    const periodPoints = await prisma.studentGroup.groupBy({
      by: ['statusChangedAt'],
      where: inPeriod,
      _count: { _all: true },
    })
    const periodSum = periodPoints.reduce((acc, point) => acc + point._count._all, 0)
    assert.equal(
      periodSum,
      rows,
      `${org.name}/${month}: столбики дают ${periodSum}, а список ${rows} — период применяется по-разному`,
    )
    if (rows < total) narrowedByPeriod++

    console.log(`${org.name}: ${total} отчислений за ${points.length} дней, за ${month} — ${rows}`)
  }

  assert.ok(checkedOrgs > 0, 'ни в одной школе нет отчислений — сверять нечего')
  assert.ok(
    narrowedByPeriod > 0,
    'период нигде не сузил выборку — проверка отбора по периоду ничего не доказывает',
  )

  console.log('\nГрафик отчислений сходится с таблицей: в любом разрезе и за период.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
