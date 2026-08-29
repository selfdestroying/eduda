/**
 * Разовый шаг перехода: закрывает занятия, которым платить нечем и некому.
 *
 * Менеджер может добавить ученика в урок, не записывая его в группу и не выбирая
 * кошелёк (`createAttendance`). Списание ищет кошелёк по записи в группу — её нет,
 * значит занятие не спишется никогда, сколько бы ученик потом ни платил. В базе
 * таких строк 201 за всю историю, и ни одна за это время цены не получила.
 *
 * Они висят в счётчике «ждут оплаты» на странице выручки и не уйдут оттуда сами:
 * оплата до них не дотягивается. Поэтому цена ставится в ноль — «занятие провели,
 * денег за него не получили». Ноль здесь не выдумка про стоимость, а то же, чем
 * закрывали долги при переходе: строка перестаёт ждать несуществующую оплату.
 *
 * Трогаются только недосягаемые: если у ученика есть запись в группу с кошельком,
 * занятие оплату дождётся и остаётся как есть. Группа берётся так же, как её берёт
 * ядро: у отработки — с пропущенного урока, у обычного занятия — со своего.
 *
 * Причину чинит проверка в `createAttendance`: без кошелька и без записи в группу
 * разовое посещение больше не заводится.
 *
 *   pnpm --filter platform exec tsx scripts/close-unbillable-attendances.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/close-unbillable-attendances.ts --apply  # записать
 */
import './load-env'

import { prisma } from '@repo/db'

const APPLY = process.argv.includes('--apply')

/** Проведённые занятия без цены, до которых списание не дотянется. */
const UNBILLABLE = `
  FROM "Attendance" a
  JOIN "Lesson" l ON l."id" = a."lessonId"
  JOIN "Student" s ON s."id" = a."studentId"
  JOIN "Organization" o ON o."id" = a."organizationId"
  -- Пропущенный урок отработки: по его группе ядро и ищет кошелёк.
  LEFT JOIN "Attendance" orig ON orig."id" = a."makeupForAttendanceId"
  LEFT JOIN "Lesson" ol ON ol."id" = orig."lessonId"
  WHERE a."price" IS NULL
    AND a."packageId" IS NULL
    AND a."isTrial" = false
    AND a."walletId" IS NULL
    AND l."status" = 'ACTIVE'
    -- Пропуск с назначенной отработкой не трогаем: деньги за пару живут на её
    -- строке. Кроме случая, когда и она неоплатная, — тогда не заплатят нигде.
    AND NOT EXISTS (
      SELECT 1 FROM "Attendance" m
      WHERE m."makeupForAttendanceId" = a."id"
        AND (
          m."price" IS NOT NULL
          OR m."walletId" IS NOT NULL
          -- Кошелёк отработки ядро ищет по группе пропущенного урока, то есть
          -- этого же: см. walletOfAttendanceTx в ledger.server.ts.
          OR EXISTS (
            SELECT 1 FROM "StudentGroup" sg
            WHERE sg."studentId" = m."studentId" AND sg."groupId" = l."groupId"
              AND sg."walletId" IS NOT NULL
          )
        )
    )
    AND (
      a."status" = 'PRESENT'
      OR (
        a."status" = 'ABSENT'
        AND (
          -- Пропущенная отработка платная при любом флаге: попытка была одна.
          a."makeupForAttendanceId" IS NOT NULL
          OR a."isWarned" IS FALSE
          OR a."isWarned" IS NULL
        )
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM "StudentGroup" sg
      WHERE sg."studentId" = a."studentId"
        AND sg."groupId" = COALESCE(ol."groupId", l."groupId")
        AND sg."walletId" IS NOT NULL
    )
`

type Row = {
  org: string
  student: string
  lessons: bigint
  since: string
  till: string
  paid: bigint
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT o."name" AS org, s."lastName" || ' ' || s."firstName" AS student,
           count(*) AS lessons, min(l."date") AS since, max(l."date") AS till,
           (SELECT count(*) FROM "Attendance" a2
             WHERE a2."studentId" = a."studentId" AND a2."price" > 0) AS paid
    ${UNBILLABLE}
    GROUP BY o."name", s."lastName", s."firstName", a."studentId"
    ORDER BY 3 DESC
  `)

  if (rows.length === 0) {
    console.info('Недосягаемых занятий нет')
    return
  }

  const total = rows.reduce((sum, r) => sum + Number(r.lessons), 0)
  const line = '─'.repeat(64)
  console.info(
    `Закрытие занятий, до которых оплата не дотянется — ${APPLY ? 'ЗАПИСЬ' : 'вхолостую'}`,
  )
  console.info(line)
  console.info(`Занятий ${total} у ${rows.length} учеников`)
  console.info(line)
  for (const r of rows.slice(0, 15)) {
    const trace = Number(r.paid) > 0 ? `платит (${r.paid} оплаченных)` : 'ни одной оплаты'
    console.info(
      `  ${r.student.padEnd(24)} ${String(r.lessons).padStart(3)}  ${r.since}…${r.till}  ${trace}`,
    )
  }
  if (rows.length > 15) console.info(`  … и ещё ${rows.length - 15} учеников`)

  if (!APPLY) {
    console.info('\nПрогон вхолостую. Записать: --apply')
    return
  }

  const written = await prisma.$executeRawUnsafe(`
    UPDATE "Attendance" SET "price" = 0
    WHERE "id" IN (SELECT a."id" ${UNBILLABLE})
  `)

  console.info(`\nЗакрыто занятий: ${written}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
