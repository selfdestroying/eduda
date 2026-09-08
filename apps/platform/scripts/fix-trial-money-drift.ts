/**
 * Разовая правка: деньги, разошедшиеся с галочкой «пробное».
 *
 * До сегодняшнего дня `updateAttendanceTrialStatus` менял только флаг — деньги за
 * ним не шли ни в одну сторону. Отметка статуса у пробного до денежных функций не
 * доходит (`isTrial` — ранний выход в `updateAttendanceStatus`), поэтому галочка,
 * переставленная на уже отмеченной строке, оставляла занятие не в том состоянии,
 * в каком его видит школа:
 *
 * - сняли галочку с отмеченного пробного → занятие навсегда «ждёт оплаты», хотя
 *   кошелёк полон (Таисия Усова, 04.09.2026);
 * - поставили галочку на отмеченное занятие → списание осталось на пробном, за
 *   которое школа денег не берёт (ученик 507, 06.09.2026, 2500 ₽).
 *
 * Скрипт ищет обе формы расхождения по всей базе — не по списку id, чтобы увидеть
 * и те, о которых мы не знаем, — и приводит деньги к нынешнему флагу штатными
 * `chargeAttendanceTx` / `unchargeAttendanceTx`. Руками ни баланс, ни остаток
 * пакета не двигаются: их двигает журнал.
 *
 * Коины не трогаются намеренно: награда за посещение могла быть уже потрачена, и
 * её пересчёт — решение школы, а не следствие галочки.
 *
 * Вхолостую по умолчанию, запись — `--apply`.
 *
 *   pnpm --filter platform exec tsx scripts/fix-trial-money-drift.ts [--apply]
 */
import './load-env'

import assert from 'node:assert/strict'
import { type Prisma, prisma } from '@repo/db'

import { UNPAID_ATTENDANCE_WHERE } from '../src/features/finances/chargeable.server'
import { chargeAttendanceTx, unchargeAttendanceTx } from '../src/features/finances/ledger.server'

const APPLY = process.argv.includes('--apply')

class Rollback extends Error {}

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

const label = {
  id: true,
  organizationId: true,
  studentId: true,
  price: true,
  student: { select: { firstName: true, lastName: true } },
  lesson: { select: { date: true, groupId: true } },
} satisfies Prisma.AttendanceSelect

type Row = Prisma.AttendanceGetPayload<{ select: typeof label }>

const name = (r: Row) =>
  `#${r.id} ${r.student.lastName} ${r.student.firstName} | ${r.lesson.date} гр.${r.lesson.groupId}`

/** Кошелёк занятия — тот же, что ищет списание: строка, иначе запись в группу. */
async function walletOf(tx: Prisma.TransactionClient, attendanceId: number) {
  const a = await tx.attendance.findUniqueOrThrow({
    where: { id: attendanceId },
    select: {
      walletId: true,
      studentId: true,
      lesson: { select: { groupId: true } },
      makeupForAttendance: { select: { lesson: { select: { groupId: true } } } },
    },
  })
  if (a.walletId) return a.walletId
  const groupId = a.makeupForAttendance?.lesson.groupId ?? a.lesson.groupId
  const sg = await tx.studentGroup.findUnique({
    where: { studentId_groupId: { studentId: a.studentId, groupId } },
    select: { walletId: true },
  })
  return sg?.walletId ?? null
}

const balanceOf = async (tx: Prisma.TransactionClient, walletId: number) =>
  (await tx.wallet.findUniqueOrThrow({ where: { id: walletId }, select: { lessonsBalance: true } }))
    .lessonsBalance

async function main() {
  try {
    await prisma.$transaction(
      async (tx) => {
        // ─── Пробные, за которые списали ───────────────────────────────────
        const charged = await tx.attendance.findMany({
          where: { isTrial: true, price: { not: null } },
          select: label,
          orderBy: { id: 'asc' },
        })

        console.log(`Пробные со списанием: ${charged.length}`)
        for (const row of charged) {
          const walletId = await walletOf(tx, row.id)
          const before = walletId ? await balanceOf(tx, walletId) : null
          await unchargeAttendanceTx(tx, {
            attendanceId: row.id,
            organizationId: row.organizationId,
            actorUserId: null,
            meta: { fix: 'пробное занятие не оплачивается' },
          })
          const after = walletId ? await balanceOf(tx, walletId) : null
          const now = await tx.attendance.findUniqueOrThrow({
            where: { id: row.id },
            select: { price: true },
          })
          assert.equal(now.price, null, 'списание с пробного обязано сняться')
          console.log(
            `  ${name(row)}: снято ${rub(row.price!)}, кошелёк ${walletId ?? '—'} ${before} → ${after}`,
          )
        }

        // ─── Непробные, которым платить есть чем ───────────────────────────
        const waiting = await tx.attendance.findMany({
          where: UNPAID_ATTENDANCE_WHERE,
          select: label,
          orderBy: { id: 'asc' },
        })

        let settled = 0
        console.log(`\nЖдут оплаты: ${waiting.length}`)
        for (const row of waiting) {
          const walletId = await walletOf(tx, row.id)
          if (!walletId) continue
          const packet = await tx.package.findFirst({
            where: { walletId, status: 'ACTIVE', remaining: { gt: 0 } },
            orderBy: [{ date: 'asc' }, { id: 'asc' }],
            select: { id: true },
          })
          if (!packet) continue

          const before = await balanceOf(tx, walletId)
          await chargeAttendanceTx(tx, {
            attendanceId: row.id,
            organizationId: row.organizationId,
            actorUserId: null,
            meta: { fix: 'снятая галочка «пробное» не позвала деньги' },
          })
          const after = await balanceOf(tx, walletId)
          const now = await tx.attendance.findUniqueOrThrow({
            where: { id: row.id },
            select: { price: true },
          })
          assert.notEqual(now.price, null, 'занятие обязано получить цену')
          settled += 1
          console.log(
            `  ${name(row)}: списано ${rub(now.price!)}, кошелёк ${walletId} ${before} → ${after}`,
          )
        }
        console.log(`  из них было чем платить: ${settled}`)

        if (!APPLY) throw new Rollback()
      },
      { timeout: 120_000 },
    )
  } catch (e) {
    if (!(e instanceof Rollback)) throw e
    console.log('\nВхолостую: ничего не записано. Запись — с флагом --apply.')
    return
  }
  console.log('\nЗаписано.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
