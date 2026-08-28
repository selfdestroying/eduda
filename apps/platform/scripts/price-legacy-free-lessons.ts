/**
 * Разовый шаг перехода: цена занятиям, которые бэкфилл истории отдал по нулю.
 *
 * `backfill-payment-packets.ts` ставит цену «в долг» по последней известной цене
 * кошелька, а если у кошелька не было ни одной оплаты — брать её неоткуда, и в
 * строке остаётся ноль. Это ученики, за которых платили мимо системы: занятия
 * были, деньги школа получила, а в базе они выглядят бесплатными и не попадают в
 * выручку.
 *
 * Цена восстанавливается по соседям — по тому, что школа в это же время брала за
 * этот же курс. Каскад, первое сработавшее:
 *
 *   группа, тот же месяц → группа, любой месяц → курс, тот же месяц →
 *   курс, любой месяц → школа, тот же месяц
 *
 * Медиана, а не среднее: одна ошибочная строка в группе не тянет цену за собой.
 *
 * Правится и строка журнала: `unitPrice` у списания обязан совпадать с ценой в
 * посещении, иначе `check-ledger.ts` разведёт «выручку по журналу» и «по строкам».
 * Журнал append-only, но эти строки написал бэкфилл несколькими минутами раньше и
 * никто их ещё не видел — это та же разовая заливка истории, а не правка учёта.
 * Баланс и остатки пакетов не двигаются: меняется только цена.
 *
 * Запускать ПОСЛЕ `backfill-payment-packets.ts` и ДО того, как школа начнёт
 * работать: после этого нули застынут в отчётах закрытых месяцев.
 *
 *   pnpm --filter platform exec tsx scripts/price-legacy-free-lessons.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/price-legacy-free-lessons.ts --apply  # записать
 */
import './load-env'

import { prisma } from '@repo/db'

const APPLY = process.argv.includes('--apply')

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

/** Цена по соседям: каскад от группы к школе, медиана внутри каждого уровня. */
const CASCADE = `
  WITH priced AS (
    SELECT a."price" AS price, l."groupId" AS gid, substr(l."date", 1, 7) AS ym,
           g."courseId" AS cid, a."organizationId" AS oid
    FROM "Attendance" a
    JOIN "Lesson" l ON l."id" = a."lessonId"
    JOIN "Group" g ON g."id" = l."groupId"
    WHERE a."price" > 0
  ),
  gm AS (SELECT gid, ym, percentile_disc(0.5) WITHIN GROUP (ORDER BY price) AS p FROM priced GROUP BY 1, 2),
  ga AS (SELECT gid,     percentile_disc(0.5) WITHIN GROUP (ORDER BY price) AS p FROM priced GROUP BY 1),
  cm AS (SELECT cid, ym, percentile_disc(0.5) WITHIN GROUP (ORDER BY price) AS p FROM priced GROUP BY 1, 2),
  ca AS (SELECT cid,     percentile_disc(0.5) WITHIN GROUP (ORDER BY price) AS p FROM priced GROUP BY 1),
  om AS (SELECT oid, ym, percentile_disc(0.5) WITHIN GROUP (ORDER BY price) AS p FROM priced GROUP BY 1, 2),
  free AS (
    SELECT a."id", a."organizationId" AS oid, l."groupId" AS gid,
           substr(l."date", 1, 7) AS ym, g."courseId" AS cid
    FROM "Attendance" a
    JOIN "Lesson" l ON l."id" = a."lessonId"
    JOIN "Group" g ON g."id" = l."groupId"
    WHERE a."price" = 0
      AND EXISTS (
        SELECT 1 FROM "WalletEntry" e
        WHERE e."attendanceId" = a."id" AND e."packageId" IS NULL AND e."unitPrice" = 0
      )
  ),
  calc AS (
    SELECT f."id", f.ym, f.oid,
           COALESCE(gm.p, ga.p, cm.p, ca.p, om.p) AS price,
           CASE WHEN gm.p IS NOT NULL THEN 'группа, тот же месяц'
                WHEN ga.p IS NOT NULL THEN 'группа, другой месяц'
                WHEN cm.p IS NOT NULL THEN 'курс, тот же месяц'
                WHEN ca.p IS NOT NULL THEN 'курс, другой месяц'
                WHEN om.p IS NOT NULL THEN 'школа, тот же месяц'
                ELSE 'источника нет' END AS source
    FROM free f
    LEFT JOIN gm ON gm.gid = f.gid AND gm.ym = f.ym
    LEFT JOIN ga ON ga.gid = f.gid
    LEFT JOIN cm ON cm.cid = f.cid AND cm.ym = f.ym
    LEFT JOIN ca ON ca.cid = f.cid
    LEFT JOIN om ON om.oid = f.oid AND om.ym = f.ym
  )
`

type Row = { id: number; ym: string; org: string; price: number | null; source: string }

async function main() {
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    ${CASCADE}
    SELECT c."id", c.ym, c.price, c.source, o."name" AS org
    FROM calc c JOIN "Organization" o ON o."id" = c.oid
    ORDER BY c.ym, c."id"
  `)

  if (rows.length === 0) {
    console.info('Занятий с нулевой ценой нет — нечего проставлять')
    return
  }

  const money = rows.reduce((sum, r) => sum + (r.price ?? 0), 0)
  const tally = (key: (r: Row) => string) => {
    const acc = new Map<string, { n: number; money: number }>()
    for (const r of rows) {
      const cur = acc.get(key(r)) ?? { n: 0, money: 0 }
      acc.set(key(r), { n: cur.n + 1, money: cur.money + (r.price ?? 0) })
    }
    return [...acc].sort((a, b) => b[1].n - a[1].n)
  }

  const line = '─'.repeat(64)
  console.info(`Цена занятиям, отданным по нулю — ${APPLY ? 'ЗАПИСЬ' : 'вхолостую'}`)
  console.info(line)
  console.info(`Занятий: ${rows.length}, добавится выручки: ${rub(money)}`)
  console.info(line)
  console.info('Откуда взята цена:')
  for (const [source, { n, money: m }] of tally((r) => r.source)) {
    console.info(`  ${source.padEnd(22)} ${String(n).padStart(4)}  ${rub(m)}`)
  }
  console.info(line)
  console.info('По школам:')
  for (const [org, { n, money: m }] of tally((r) => r.org)) {
    console.info(`  ${org.padEnd(22)} ${String(n).padStart(4)}  ${rub(m)}`)
  }
  console.info(line)
  console.info('По месяцам:')
  for (const [ym, { n, money: m }] of tally((r) => r.ym).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.info(`  ${ym}  ${String(n).padStart(4)} зан.  ${rub(m)}`)
  }

  const orphans = rows.filter((r) => r.price === null)
  if (orphans.length > 0) {
    console.info(line)
    console.info(`Без источника цены: ${orphans.length} (останутся с нулём)`)
  }

  if (!APPLY) {
    console.info('\nПрогон вхолостую. Записать: --apply')
    return
  }

  const [attendances, entries] = await prisma.$transaction([
    prisma.$executeRawUnsafe(`
      ${CASCADE}
      UPDATE "Attendance" a SET "price" = c.price
      FROM calc c
      WHERE a."id" = c."id" AND a."price" = 0 AND c.price IS NOT NULL
    `),
    // Журнал берёт цену из строки, которую только что проставили: так они не
    // разъедутся, даже если каскад поменяется.
    prisma.$executeRawUnsafe(`
      UPDATE "WalletEntry" e SET "unitPrice" = a."price"
      FROM "Attendance" a
      WHERE e."attendanceId" = a."id" AND e."packageId" IS NULL
        AND e."unitPrice" = 0 AND a."price" > 0
    `),
  ])

  console.info(`\nПроставлено занятий: ${attendances}, строк журнала: ${entries}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
