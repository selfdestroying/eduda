/**
 * Разовый шаг перехода: деньги из счётчиков кошелька — в пакеты.
 *
 * До платформы (и какое-то время на ней) «сколько ученик заплатил» жило в
 * `Wallet.totalPayments` — счётчике, который вела старая модель. Новая считает
 * деньги по пакетам: `Авансы` берут `Package.price` и счётчик не читают. Пока
 * разница не перенесена, отчёт объявляет должником каждого, чьи деньги остались
 * в счётчике, — по «Алгоритмике» это половина школы.
 *
 * Переносится РАЗНИЦА `totalPayments − Σ price пакетов`, а не сам счётчик: у
 * кошельков, где оплаты уже заведены, счётчик включает их же, и перенос целиком
 * посчитал бы деньги дважды. Отсюда же идемпотентность: после записи разница
 * становится нулём и повторный прогон ничего не находит.
 *
 * Пакет заводится денежный, без уроков (`lessonCount = 0`): уроки за этот период
 * уже перенесены пакетами «Остаток на начало учёта пакетов», и вторая порция
 * задвоила бы баланс. Журнал и остатки поэтому не двигаются вовсе — меняется
 * только денежная сторона.
 *
 * Дата пакета — день первого занятия ученика, а не сегодня и не день появления
 * кошелька: `Авансы` фильтруют по `createdAt`, а кошельки завели только в марте
 * 2026, когда 392 из 399 учеников уже полгода как ходили. Датируй переход мартом —
 * и вся осень осталась бы в фантомном долге. Точной даты прихода денег нет нигде:
 * школа работает по предоплате, поэтому берётся начало занятий.
 *
 * Счётчик остаётся как есть: он больше не источник правды, но переписывать
 * историю ради красоты нет причины.
 *
 *   pnpm --filter platform exec tsx scripts/backfill-legacy-package-money.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/backfill-legacy-package-money.ts --apply  # записать
 */
import './load-env'

import { prisma } from '@repo/db'

const APPLY = process.argv.includes('--apply')

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

/** Кошельки, где счётчик денег обгоняет пакеты, и размер отставания. */
const DELTA = `
  WITH src AS (
    SELECT w."id" AS wid, w."organizationId" AS oid, w."studentId" AS sid,
           LEAST(to_char(w."createdAt", 'YYYY-MM-DD'), fl.first_lesson) AS created,
           w."totalPayments" AS counters,
           COALESCE((
             SELECT SUM(p."price") FROM "Package" p
             WHERE p."walletId" = w."id" AND p."status" = 'ACTIVE'
           ), 0) AS packaged
    FROM "Wallet" w
    LEFT JOIN LATERAL (
      SELECT MIN(l."date") AS first_lesson
      FROM "Attendance" a JOIN "Lesson" l ON l."id" = a."lessonId"
      WHERE a."studentId" = w."studentId" AND a."organizationId" = w."organizationId"
    ) fl ON true
  ),
  delta AS (
    SELECT wid, oid, sid, created, counters, packaged, counters - packaged AS money
    FROM src WHERE counters - packaged > 0
  )
`

type Row = { org: string; wallets: bigint; money: bigint; oldest: string }

async function main() {
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    ${DELTA}
    SELECT o."name" AS org, count(*) AS wallets, sum(d.money) AS money, min(d.created) AS oldest
    FROM delta d JOIN "Organization" o ON o."id" = d.oid
    GROUP BY 1 ORDER BY 3 DESC
  `)

  if (rows.length === 0) {
    console.info('Счётчики не обгоняют пакеты — переносить нечего')
    return
  }

  const line = '─'.repeat(64)
  console.info(`Деньги из счётчиков в пакеты — ${APPLY ? 'ЗАПИСЬ' : 'вхолостую'}`)
  console.info(line)
  for (const r of rows) {
    console.info(
      `  ${r.org.padEnd(22)} ${String(r.wallets).padStart(4)} кош.  ${rub(Number(r.money))}  с ${r.oldest}`,
    )
  }
  console.info(line)
  console.info(`Всего: ${rub(rows.reduce((s, r) => s + Number(r.money), 0))}`)

  const top = await prisma.$queryRawUnsafe<
    { student: string; counters: number; packaged: number; money: number }[]
  >(`
    ${DELTA}
    SELECT s."lastName" || ' ' || s."firstName" AS student, d.counters, d.packaged, d.money
    FROM delta d JOIN "Student" s ON s."id" = d.sid
    ORDER BY d.money DESC LIMIT 5
  `)
  console.info(line)
  console.info('Самые крупные:')
  for (const t of top) {
    console.info(
      `  ${t.student.padEnd(28)} счётчик ${rub(t.counters)} − пакеты ${rub(t.packaged)} = ${rub(t.money)}`,
    )
  }

  if (!APPLY) {
    console.info('\nПрогон вхолостую. Записать: --apply')
    return
  }

  const written = await prisma.$executeRawUnsafe(`
    ${DELTA}
    INSERT INTO "Package" (
      "lessonCount", "remaining", "unitPrice", "price", "date", "status",
      "createdAt", "updatedAt", "organizationId", "studentId", "walletId", "productName"
    )
    SELECT 0, 0, 0, d.money, d.created, 'ACTIVE',
           d.created::timestamp, now(), d.oid, d.sid, d.wid, 'Оплачено до перехода'
    FROM delta d
  `)

  console.info(`\nЗаведено денежных пакетов: ${written}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
