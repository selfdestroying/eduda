/**
 * Разовая правка: занятия, которые ждут оплаты при полном кошельке.
 *
 * Кошелёк занятие получает тремя способами: своя строка (разовый визит), запись
 * в группу — и до сегодняшнего дня только два из них умели гасить накопившееся.
 * `linkGroupToWallet` привязывал группу к кошельку и деньгами не занимался, а
 * `settleUnpaidAttendancesTx` ищет занятия как раз через группы кошелька. Порядок
 * «ученик пришёл → оплату завели новым кошельком → группу привязали к нему после»
 * поэтому оставлял проведённое занятие без цены навсегда: оплата его не увидела
 * (группы у кошелька ещё не было), а привязка не позвала деньги. Повторный клик по
 * статусу тоже не помогает — класс строки не менялся, и `updateAttendanceStatus`
 * выходит раньше денежных функций.
 *
 * На 09.09.2026 таких строк три: Колесниковы Михаил и Павел (школа alg, группа 262)
 * и смирнов артем (школа aclass, группа 255).
 *
 * Ищет по всей базе, а не по списку id: тем же предикатом, что и списание, — то
 * есть ровно то, что закрыла бы следующая оплата на этот кошелёк. Гасит штатным
 * `chargeAttendanceTx`, руками ни баланс, ни остаток пакета не двигаются.
 *
 * Вхолостую по умолчанию, запись — `--apply`.
 *
 *   pnpm --filter platform exec tsx scripts/fix-unlinked-wallet-money.ts [--apply]
 */
import './load-env'

import assert from 'node:assert/strict'
import { type Prisma, prisma } from '@repo/db'

import { UNPAID_ATTENDANCE_WHERE } from '../src/features/finances/chargeable.server'
import { chargeAttendanceTx } from '../src/features/finances/ledger.server'

const APPLY = process.argv.includes('--apply')

class Rollback extends Error {}

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

const label = {
  id: true,
  organizationId: true,
  studentId: true,
  walletId: true,
  student: { select: { firstName: true, lastName: true } },
  lesson: { select: { date: true, groupId: true } },
  makeupForAttendance: { select: { lesson: { select: { groupId: true } } } },
} satisfies Prisma.AttendanceSelect

type Row = Prisma.AttendanceGetPayload<{ select: typeof label }>

const name = (r: Row) =>
  `#${r.id} ${r.student.lastName} ${r.student.firstName} | ${r.lesson.date} гр.${r.lesson.groupId}`

/** Кошелёк занятия — тот же, что ищет списание: строка, иначе запись в группу. */
async function walletOf(tx: Prisma.TransactionClient, row: Row) {
  if (row.walletId) return row.walletId
  const groupId = row.makeupForAttendance?.lesson.groupId ?? row.lesson.groupId
  const sg = await tx.studentGroup.findUnique({
    where: { studentId_groupId: { studentId: row.studentId, groupId } },
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
        const waiting = await tx.attendance.findMany({
          where: UNPAID_ATTENDANCE_WHERE,
          select: label,
          orderBy: { id: 'asc' },
        })
        console.log(`Ждут оплаты всего: ${waiting.length}`)

        let settled = 0
        for (const row of waiting) {
          const walletId = await walletOf(tx, row)
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
            meta: { fix: 'кошелёк привязан к группе после оплаты — списание не позвали' },
          })
          const after = await balanceOf(tx, walletId)
          const now = await tx.attendance.findUniqueOrThrow({
            where: { id: row.id },
            select: { price: true },
          })
          assert.notEqual(now.price, null, 'занятие обязано получить цену')
          assert.equal(after, before - 1, 'остаток кошелька обязан уменьшиться на урок')
          settled += 1
          console.log(
            `  ${name(row)}: списано ${rub(now.price!)}, кошелёк ${walletId} ${before} → ${after}`,
          )
        }
        console.log(`Из них было чем платить: ${settled}`)

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
