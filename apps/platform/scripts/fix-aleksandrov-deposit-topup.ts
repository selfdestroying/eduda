/**
 * Разовая правка: депозит Виталия Александрова — девятый кошелёк той же истории,
 * что разобрал `fix-deposit-topup-packages.ts` 06.09.
 *
 * Депозит собран двумя взносами по 2 500 ₽ (пакеты 1815 и 2249, каждый заведён
 * как «1 занятие»), а 08.09 приехала доплата 490 ₽ продуктом «Доплата депозита»
 * — он в справочнике тоже одно занятие. Итого 5 490 ₽, ровно цена продукта
 * «4 занятия», но на кошельке лежат три урока по цене взноса, и занятие 06.09
 * (att 62536) сгорело по 2 500 ₽ вместо 1 372 ₽.
 *
 * Восемь таких кошельков поправили два дня назад; этот приехал позже — доплату
 * завели только сегодня. Форма правки повторяется один в один:
 *
 *   1. снять списание с занятия, сгоревшего по цене взноса;
 *   2. отменить три пакета вместе со счетами (счета не удаляются: у доплаты
 *      `externalId` — ключ идемпотентности опроса amoCRM);
 *   3. завести один пакет «4 занятия» на 5 490 ₽ — выдача тут же подберёт
 *      ждавшее занятие и спишет его уже по 1 372 ₽.
 *
 * Дата нового пакета — 01.09, общая дата всего разбора депозитов
 * (`fix-deposit-topup-followup.ts`). Баланс кошелька станет 3.
 *
 *   pnpm --filter platform exec tsx scripts/fix-aleksandrov-deposit-topup.ts          # вхолостую
 *   pnpm --filter platform exec tsx scripts/fix-aleksandrov-deposit-topup.ts --apply  # записать
 */
import './load-env'

import assert from 'node:assert/strict'
import { type Prisma, prisma } from '@repo/db'
import { cancelPackageTx, unchargeAttendanceTx } from '../src/features/finances/ledger.server'
import {
  PAYMENT_TX_OPTIONS,
  createPaymentWithPackageTx,
} from '../src/features/finances/payments/create.server'

const APPLY = process.argv.includes('--apply')

const ORGANIZATION_ID = 1
const STUDENT_ID = 794
const WALLET_ID = 1147
/** 2 500 + 2 500 + 490. */
const OLD_PACKAGES = [1815, 2249, 3864]
const PRICE = 5_490
/** Продукт 1 «4 занятия», 5 490 ₽ — до него и добирался депозит. */
const PRODUCT_ID = 1
const LESSONS = 4
const UNIT = Math.floor(PRICE / LESSONS)
/** Начало учебного года — общая дата разбора депозитов. */
const DATE = '2026-09-01'
/** Маргарита Кошелева — она заводила доплату. */
const MANAGER_ID = 4

class Rollback extends Error {}

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

type Snapshot = {
  balance: number
  packages: {
    id: number
    lessonCount: number
    remaining: number
    price: number
    unitPrice: number
    date: string
    status: string
    productName: string
  }[]
  ledgerSum: number
  charged: { id: number; date: string; price: number | null; packageId: number | null }[]
}

async function snapshot(tx: Prisma.TransactionClient | typeof prisma): Promise<Snapshot> {
  const wallet = await tx.wallet.findUniqueOrThrow({
    where: { id: WALLET_ID },
    select: { lessonsBalance: true },
  })
  const packages = await tx.package.findMany({
    where: { walletId: WALLET_ID },
    select: {
      id: true,
      lessonCount: true,
      remaining: true,
      price: true,
      unitPrice: true,
      date: true,
      status: true,
      productName: true,
    },
    orderBy: { id: 'asc' },
  })
  const entries = await tx.walletEntry.findMany({
    where: { walletId: WALLET_ID },
    select: { quantity: true, packageId: true },
  })
  const atts = await tx.attendance.findMany({
    where: { studentId: STUDENT_ID, packageId: { in: packages.map((p) => p.id) } },
    select: { id: true, price: true, packageId: true, lesson: { select: { date: true } } },
    orderBy: { id: 'asc' },
  })
  return {
    balance: wallet.lessonsBalance,
    packages,
    ledgerSum: entries.reduce((sum, e) => sum + e.quantity, 0),
    charged: atts.map((a) => ({
      id: a.id,
      date: a.lesson.date,
      price: a.price,
      packageId: a.packageId,
    })),
  }
}

function show(label: string, s: Snapshot) {
  console.log(`\n── ${label} ──`)
  console.log(`  баланс ${s.balance}, Σ журнала ${s.ledgerSum}`)
  for (const p of s.packages) {
    if (p.status === 'CANCELLED') continue
    console.log(
      `  пакет ${p.id}: ${p.lessonCount} зан. ост.${p.remaining} ${rub(p.price)} ` +
        `@${rub(p.unitPrice)} от ${p.date}  ${p.productName || '—'}`,
    )
  }
  for (const a of s.charged) {
    console.log(`  занятие ${a.date} (att ${a.id}): ${rub(a.price ?? 0)} из пакета ${a.packageId}`)
  }
}

async function main() {
  // ── Защита от опечатки в номерах ───────────────────────────────────────────
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: STUDENT_ID },
    select: { firstName: true, lastName: true, organizationId: true },
  })
  assert.equal(student.organizationId, ORGANIZATION_ID, 'ученик не из этой школы')
  assert.equal(`${student.lastName} ${student.firstName}`, 'Александров Виталий', 'не тот ученик')

  const wallet = await prisma.wallet.findUniqueOrThrow({
    where: { id: WALLET_ID },
    select: { studentId: true, organizationId: true, status: true, name: true },
  })
  assert.equal(wallet.studentId, STUDENT_ID, 'кошелёк не этого ученика')
  assert.equal(wallet.organizationId, ORGANIZATION_ID, 'кошелёк не этой школы')
  assert.equal(wallet.status, 'ACTIVE', 'кошелёк архивирован')
  assert.equal(wallet.name, 'Депозит 26/27', 'не тот кошелёк')

  const old = await prisma.package.findMany({
    where: { id: { in: OLD_PACKAGES }, walletId: WALLET_ID },
    select: { id: true, price: true, status: true, paymentId: true },
  })
  assert.equal(old.length, OLD_PACKAGES.length, 'пакеты списка не нашлись на кошельке')
  const sum = old.reduce((acc, p) => acc + p.price, 0)
  assert.equal(sum, PRICE, `взносы дают ${sum}, а ожидалось ${PRICE}`)

  const before = await snapshot(prisma)
  show('Сейчас', before)

  if (old.every((p) => p.status === 'CANCELLED')) {
    console.log('\nУже исправлено.')
    await prisma.$disconnect()
    return
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Снять списание: урок возвращается на старый пакет, цена уходит в null,
      //    и занятие снова попадает под UNPAID_ATTENDANCE_WHERE.
      const charged = await tx.attendance.findMany({
        where: { packageId: { in: OLD_PACKAGES }, price: { not: null } },
        select: { id: true },
      })
      for (const attendance of charged) {
        await unchargeAttendanceTx(tx, {
          attendanceId: attendance.id,
          organizationId: ORGANIZATION_ID,
          actorUserId: MANAGER_ID,
          meta: { fix: 'deposit-topup', walletId: WALLET_ID },
        })
      }

      // 2. Отменить пакеты вместе со счетами.
      for (const packet of old) {
        await cancelPackageTx(tx, {
          packageId: packet.id,
          organizationId: ORGANIZATION_ID,
          actorUserId: MANAGER_ID,
          effectiveAt: DATE,
        })
        if (packet.paymentId !== null) {
          await tx.payment.update({
            where: { id: packet.paymentId },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          })
        }
      }

      // 3. Один пакет вместо них: выдача подберёт занятие, оставшееся без оплаты.
      const created = await createPaymentWithPackageTx(tx, {
        organizationId: ORGANIZATION_ID,
        studentId: STUDENT_ID,
        walletId: WALLET_ID,
        productId: PRODUCT_ID,
        lessonCount: LESSONS,
        price: PRICE,
        date: DATE,
        managerId: MANAGER_ID,
        received: true,
        actorUserId: MANAGER_ID,
        meta: { fix: 'deposit-topup' },
      })
      assert.equal(
        created.settled,
        charged.length,
        `снято списаний ${charged.length}, а закрылось ${created.settled}`,
      )

      // ── Инварианты внутри транзакции ─────────────────────────────────────────
      const after = await snapshot(tx)
      const fresh = after.packages.find((p) => p.id === created.packageId)
      assert.ok(fresh, 'новый пакет не нашёлся')
      assert.equal(fresh.lessonCount, LESSONS, `в новом пакете не ${LESSONS} занятий`)
      assert.equal(fresh.price, PRICE, 'сумма нового пакета не та')
      assert.equal(fresh.unitPrice, UNIT, 'цена урока не та')
      assert.equal(fresh.remaining, LESSONS - charged.length, 'остаток нового пакета не тот')
      assert.equal(after.balance, fresh.remaining, 'баланс разошёлся с остатком пакета')
      assert.equal(after.balance, after.ledgerSum, 'журнал разошёлся с балансом')
      assert.equal(after.charged.length, charged.length, 'списанных занятий стало не столько')
      for (const a of after.charged) {
        assert.equal(a.price, UNIT, `att ${a.id}: цена осталась старой`)
        assert.equal(a.packageId, fresh.id, `att ${a.id}: висит не на новом пакете`)
      }

      show(APPLY ? 'После' : 'Стало бы', after)
      if (!APPLY) throw new Rollback()
    }, PAYMENT_TX_OPTIONS)
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  if (!APPLY) {
    const back = await snapshot(prisma)
    assert.deepEqual(back, before, 'откат не вернул базу в исходное состояние')
    console.log('\n— прогон вхолостую, откат сошёлся. Записать: --apply')
  } else {
    console.log('\n— записано.')
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
