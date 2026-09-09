/**
 * Разовая правка: вторая партия депозитов с доплатой — шесть кошельков той же
 * истории, что разобрали `fix-deposit-topup-packages.ts` 06.09 и
 * `fix-aleksandrov-deposit-topup.ts` 08.09.
 *
 * Депозит 5 000 ₽ вносили одним, двумя или тремя взносами, каждый заводили как
 * «1 занятие» по цене взноса, а 07–09.09 приехала доплата 490 ₽ продуктом
 * «Доплата депозита» — он в справочнике тоже занятие, а не деньги. Итого 5 490 ₽,
 * ровно цена продукта «4 занятия», но уроки на кошельке лежат по 2 500 или
 * 5 000 ₽, и сентябрьские занятия сгорают по цене взноса.
 *
 * ── Что изменилось со времён первой партии ───────────────────────────────────
 *
 * Количество занятий в доплате теперь подгоняют так, чтобы баланс кошелька сошёлся:
 * 490 ₽ заводят как 2, 3 или 4 занятия (по 245, 163 и 122 ₽ за урок). Баланс от
 * этого стал верным у пятерых из шести — а цена урока неверна у всех. Ошибка стала
 * тише: в кошельке всё выглядит правильно, в выручке нет.
 *
 * Исключение — Сергеев: ему выдали доплатой четыре урока вместо трёх, и один из них
 * уже сгорел по 122 ₽. У него единственного баланс поедет, 3 → 2.
 *
 * ── Даты ─────────────────────────────────────────────────────────────────────
 *
 * У пятерых — 01.09, общая дата всего разбора депозитов. У Сергеева — 31.08: его
 * первое занятие прошло 31.08, и пакет от 01.09 оказался бы датирован позже урока,
 * который он оплачивает. Это же занятие переоценивается в августе — единственное
 * место во всём разборе, где двигается закрытый месяц: 5 000 ₽ → 1 372 ₽.
 *
 * ── Форма правки ─────────────────────────────────────────────────────────────
 *
 *   1. снять списания с занятий, сгоревших по цене взноса;
 *   2. отменить старые пакеты вместе со счетами (счета не удаляются: у доплаты
 *      `externalId` — ключ идемпотентности опроса amoCRM);
 *   3. завести один пакет «4 занятия» на сумму взносов — выдача тут же подберёт
 *      ждавшие занятия и спишет их по цене продукта.
 *
 * Сумма — настоящие взносы, а не 5 490 ₽ из справочника: у Александрова взносы по
 * 1 670 ₽ дают 5 500 ₽, отсюда 1 375 ₽ за урок вместо 1 372 ₽.
 *
 *   pnpm --filter platform exec tsx scripts/fix-deposit-topup-batch2.ts          # вхолостую
 *   pnpm --filter platform exec tsx scripts/fix-deposit-topup-batch2.ts --apply  # записать
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
/** Продукт 1 «4 занятия», 5 490 ₽ — до него и добирался депозит. */
const PRODUCT_ID = 1
const LESSONS = 4
/** Маргарита Кошелева — она заводила все доплаты. */
const MANAGER_ID = 4
/** Начало учебного года — общая дата разбора депозитов. */
const DATE = '2026-09-01'

type Target = {
  name: string
  studentId: number
  walletId: number
  walletName: string
  /** Взносы и доплата — всё, что заменит один пакет. */
  packages: number[]
  price: number
  /** Своя дата, если общая оказалась бы позже оплаченного занятия. */
  date?: string
  /** Сколько занятий уже отходили: остаток нового пакета будет `LESSONS − это`. */
  charged: number
}

const TARGETS: Target[] = [
  {
    name: 'Александров Кирилл',
    studentId: 113,
    walletId: 1079,
    walletName: 'Депозит 26/27',
    /** 1 670 × 3 + 490. */
    packages: [1571, 2039, 2348, 3853],
    price: 5_500,
    charged: 0,
  },
  {
    name: 'Богатиков Михаил',
    studentId: 203,
    walletId: 1105,
    walletName: 'Депозит',
    /** 5 000 + 490, доплата заведена тремя занятиями по 163 ₽. */
    packages: [1665, 3865],
    price: 5_490,
    charged: 1,
  },
  {
    name: 'Смирнова Юлия',
    studentId: 312,
    walletId: 1110,
    walletName: 'Депозит 26/27',
    /** 2 500 × 2 + 490, доплата заведена двумя занятиями по 245 ₽. */
    packages: [1671, 2224, 3849],
    price: 5_490,
    charged: 1,
  },
  {
    name: 'Никитенко Даниил',
    studentId: 743,
    walletId: 1120,
    walletName: 'Депозит 26/27',
    packages: [1722, 3918],
    price: 5_490,
    charged: 1,
  },
  {
    name: 'Трусов Иван',
    studentId: 223,
    walletId: 1121,
    walletName: 'Депозит 26/27',
    packages: [1723, 2195, 3857],
    price: 5_490,
    charged: 1,
  },
  {
    name: 'Сергеев Леонид',
    studentId: 149,
    walletId: 1146,
    walletName: 'Депозит 26/27',
    /** 5 000 + 490, доплата заведена четырьмя занятиями по 122 ₽ — на один больше,
     *  чем он мог получить. Отсюда единственный съезжающий баланс: 3 → 2. */
    packages: [1813, 3852],
    price: 5_490,
    /** Его первое занятие прошло 31.08 — пакет не должен быть датирован позже. */
    date: '2026-08-31',
    charged: 2,
  },
]

class Rollback extends Error {}

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`
const unitOf = (price: number) => Math.floor(price / LESSONS)

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

async function snapshot(
  db: Prisma.TransactionClient | typeof prisma,
  target: Target,
): Promise<Snapshot> {
  const wallet = await db.wallet.findUniqueOrThrow({
    where: { id: target.walletId },
    select: { lessonsBalance: true },
  })
  const packages = await db.package.findMany({
    where: { walletId: target.walletId },
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
  const entries = await db.walletEntry.findMany({
    where: { walletId: target.walletId },
    select: { quantity: true },
  })
  const atts = await db.attendance.findMany({
    where: { packageId: { in: packages.map((p) => p.id) } },
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

function show(label: string, target: Target, s: Snapshot) {
  console.log(`\n── ${target.name} · ${label} ──`)
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

/** Проверка номеров до единой записи: опечатка в id тише всего. */
async function verify(target: Target) {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: target.studentId },
    select: { firstName: true, lastName: true, organizationId: true },
  })
  assert.equal(student.organizationId, ORGANIZATION_ID, `${target.name}: ученик не из этой школы`)
  assert.equal(`${student.lastName} ${student.firstName}`, target.name, 'не тот ученик')

  const wallet = await prisma.wallet.findUniqueOrThrow({
    where: { id: target.walletId },
    select: { studentId: true, organizationId: true, status: true, name: true },
  })
  assert.equal(wallet.studentId, target.studentId, `${target.name}: кошелёк не этого ученика`)
  assert.equal(wallet.organizationId, ORGANIZATION_ID, `${target.name}: кошелёк не этой школы`)
  assert.equal(wallet.status, 'ACTIVE', `${target.name}: кошелёк архивирован`)
  assert.equal(wallet.name, target.walletName, `${target.name}: не тот кошелёк`)

  const old = await prisma.package.findMany({
    where: { id: { in: target.packages }, walletId: target.walletId },
    select: { id: true, price: true, status: true, paymentId: true },
  })
  assert.equal(old.length, target.packages.length, `${target.name}: пакеты списка не нашлись`)
  const sum = old.reduce((acc, p) => acc + p.price, 0)
  assert.equal(sum, target.price, `${target.name}: взносы дают ${sum}, а ожидалось ${target.price}`)
  return old
}

async function run(target: Target): Promise<number> {
  const old = await verify(target)
  const date = target.date ?? DATE
  const unit = unitOf(target.price)

  const before = await snapshot(prisma, target)
  show('Сейчас', target, before)

  if (old.every((p) => p.status === 'CANCELLED')) {
    console.log('  уже исправлено')
    return 0
  }

  let revenue = 0

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Снять списания: уроки возвращаются на старые пакеты, цена уходит в null,
      //    и занятия снова попадают под UNPAID_ATTENDANCE_WHERE.
      const charged = await tx.attendance.findMany({
        where: { packageId: { in: target.packages }, price: { not: null } },
        select: { id: true, price: true, amount: true },
      })
      assert.equal(
        charged.length,
        target.charged,
        `${target.name}: списанных занятий ${charged.length}, а ожидалось ${target.charged}`,
      )
      for (const attendance of charged) {
        revenue += (unit - (attendance.price ?? 0)) * attendance.amount
        await unchargeAttendanceTx(tx, {
          attendanceId: attendance.id,
          organizationId: ORGANIZATION_ID,
          actorUserId: MANAGER_ID,
          meta: { fix: 'deposit-topup', walletId: target.walletId },
        })
      }

      // 2. Отменить пакеты вместе со счетами.
      for (const packet of old) {
        await cancelPackageTx(tx, {
          packageId: packet.id,
          organizationId: ORGANIZATION_ID,
          actorUserId: MANAGER_ID,
          effectiveAt: date,
        })
        if (packet.paymentId !== null) {
          await tx.payment.update({
            where: { id: packet.paymentId },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          })
        }
      }

      // 3. Один пакет вместо них: выдача подберёт занятия, оставшиеся без оплаты.
      const created = await createPaymentWithPackageTx(tx, {
        organizationId: ORGANIZATION_ID,
        studentId: target.studentId,
        walletId: target.walletId,
        productId: PRODUCT_ID,
        lessonCount: LESSONS,
        price: target.price,
        date,
        managerId: MANAGER_ID,
        received: true,
        actorUserId: MANAGER_ID,
        meta: { fix: 'deposit-topup' },
      })
      assert.equal(
        created.settled,
        charged.length,
        `${target.name}: снято списаний ${charged.length}, а закрылось ${created.settled}`,
      )

      // ── Инварианты внутри транзакции ──────────────────────────────────────
      const after = await snapshot(tx, target)
      const fresh = after.packages.find((p) => p.id === created.packageId)
      assert.ok(fresh, `${target.name}: новый пакет не нашёлся`)
      assert.equal(fresh.lessonCount, LESSONS, `${target.name}: в пакете не ${LESSONS} занятий`)
      assert.equal(fresh.price, target.price, `${target.name}: сумма пакета не та`)
      assert.equal(fresh.unitPrice, unit, `${target.name}: цена урока не та`)
      assert.equal(fresh.date, date, `${target.name}: дата пакета не та`)
      assert.equal(
        fresh.remaining,
        LESSONS - charged.length,
        `${target.name}: остаток пакета не тот`,
      )
      assert.equal(after.balance, fresh.remaining, `${target.name}: баланс ≠ остаток пакета`)
      assert.equal(after.balance, after.ledgerSum, `${target.name}: журнал разошёлся с балансом`)
      assert.equal(
        after.charged.length,
        charged.length,
        `${target.name}: списанных занятий стало не столько`,
      )
      for (const a of after.charged) {
        assert.equal(a.price, unit, `${target.name}, att ${a.id}: цена осталась старой`)
        assert.equal(a.packageId, fresh.id, `${target.name}, att ${a.id}: висит не на новом пакете`)
      }

      show(APPLY ? 'После' : 'Стало бы', target, after)
      if (!APPLY) throw new Rollback()
    }, PAYMENT_TX_OPTIONS)
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  if (!APPLY) {
    const back = await snapshot(prisma, target)
    assert.deepEqual(back, before, `${target.name}: откат не вернул базу в исходное состояние`)
  }

  return revenue
}

async function main() {
  let revenue = 0
  for (const target of TARGETS) revenue += await run(target)

  console.log(`\nВыручка: ${revenue >= 0 ? '+' : ''}${rub(revenue)}`)
  console.log(APPLY ? '\n— записано.' : '\n— прогон вхолостую, откаты сошлись. Записать: --apply')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
