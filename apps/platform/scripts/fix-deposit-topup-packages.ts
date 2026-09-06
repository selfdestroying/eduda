/**
 * Разовая правка: депозит, собранный по частям, и «Доплата депозита» уроками.
 *
 * Школа берёт депозит 5 000 ₽ вперёд — иногда одним платежом, иногда двумя-тремя
 * взносами по 1 670 или 2 500 ₽ — а в конце лета добирает 490 ₽ до 5 490 ₽, цены
 * продукта «4 занятия». Каждый взнос заводили отдельным пакетом «1 занятие за
 * 1 670 ₽», а доплату — продуктом «Доплата депозита», который в справочнике
 * объявлен как **1 занятие за 490 ₽**.
 *
 * Из-за этого у кошелька вместо четырёх уроков по 1 372 ₽ лежит два-четыре урока
 * по цене взноса, и первое же занятие сентября сгорает по 1 670, 2 500 или
 * 5 000 ₽. Баланс при этом врёт в обе стороны: у Сенько не хватает двух уроков, у
 * Сулимовой один лишний.
 *
 * ── Откуда берётся «4 занятия за 5 490 ₽» ────────────────────────────────────
 *
 * Три независимых источника, и все три сходятся:
 *
 *   • 490 = 5 490 − 5 000 ровно — доплата добирает депозит до цены продукта;
 *   • в справочнике 5 490 ₽ стоит только продукт 1 «4 занятия» (1 372 ₽/урок);
 *   • Котовой (кошелёк 1131) менеджер разобрал это сам: отменил оба депозита с
 *     доплатой и завёл «4 занятия за 5 490 ₽». Здесь повторяется её форма.
 *
 * ── Что делает скрипт ────────────────────────────────────────────────────────
 *
 * По кошельку, в одной транзакции:
 *
 *   1. снимает списание с занятия, сгоревшего по цене взноса (урок возвращается,
 *      цена уходит в `null` — занятие снова ждёт оплаты);
 *   2. отменяет старые пакеты (`cancelPackageTx`) и их счета;
 *   3. заводит один пакет «4 занятия» на сумму всех взносов
 *      (`createPaymentWithPackageTx`, `received: true`) — выдача тут же подбирает
 *      ждавшее занятие и списывает его уже по 1 372 ₽.
 *
 * `price` нового пакета — **сумма настоящих взносов**, а не 5 490 ₽ из
 * справочника: это деньги, которые действительно пришли. Отсюда три цены урока —
 * 1 375 ₽ там, где взносы дали 5 500 ₽, 1 372 ₽ при ровных 5 490 ₽ и 1 357 ₽ у
 * Харькова, у которого второй взнос заведён как 1 607 ₽. Похоже на опечатку в
 * 1 667 ₽, но 59 ₽ подтвердить может только школа, и выдумывать их скрипт не
 * будет.
 *
 * ── Что при этом двигается ───────────────────────────────────────────────────
 *
 * Дата платежа. Модель не умеет «один пакет, четыре платёжных дня»: у пакета один
 * счёт. Поэтому старые счета отменяются, а новый выписывается днём доплаты — днём,
 * когда сумма стала целой. В отчёте по оплатам деньги уезжают из марта–июня в
 * август–сентябрь. Выручка не двигается вовсе: она считается по дате занятия.
 *
 *   pnpm --filter platform exec tsx scripts/fix-deposit-topup-packages.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/fix-deposit-topup-packages.ts --apply  # записать
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import { cancelPackageTx, unchargeAttendanceTx } from '../src/features/finances/ledger.server'
import {
  PAYMENT_TX_OPTIONS,
  createPaymentWithPackageTx,
} from '../src/features/finances/payments/create.server'

const APPLY = process.argv.includes('--apply')

const ORGANIZATION_ID = 1
/** Продукт 1 «4 занятия», 5 490 ₽. Депозит с доплатой добирался именно до него. */
const PRODUCT_ID = 1
const LESSONS = 4
/** Маргарита Кошелева — она заводила все доплаты. */
const MANAGER_ID = 4

const TARGETS = [
  {
    name: 'Сажин Елисей',
    walletId: 1027,
    studentId: 334,
    /** 1 670 × 3 + 490. */
    packages: [1359, 1728, 2149, 3759],
    price: 5_500,
    date: '2026-09-03',
  },
  {
    name: 'Вознесенский Андрей',
    walletId: 1029,
    studentId: 335,
    packages: [1377, 1684, 2109, 3777],
    price: 5_500,
    date: '2026-09-04',
  },
  {
    name: 'Сулимова Елена',
    walletId: 1114,
    studentId: 282,
    /** Доплата заведена двумя занятиями — отсюда лишний урок на балансе. */
    packages: [1688, 1730, 2180, 3754],
    price: 5_500,
    date: '2026-09-03',
  },
  {
    name: 'Сенько Игорь',
    walletId: 1118,
    studentId: 506,
    /** Депозит одним платежом: 5 000 + 490. */
    packages: [1691, 3675],
    price: 5_490,
    date: '2026-08-31',
  },
  {
    name: 'Михайлов Никита',
    walletId: 1149,
    studentId: 514,
    /** 2 500 × 2 + 490. */
    packages: [1820, 2424, 3826],
    price: 5_490,
    date: '2026-09-06',
  },
  {
    name: 'Подшивалова Сабина',
    walletId: 1151,
    studentId: 323,
    packages: [1822, 2256, 3828],
    price: 5_490,
    date: '2026-09-06',
  },
  {
    name: 'Технарев Матвей',
    walletId: 1184,
    studentId: 171,
    /** Доплата заведена двумя занятиями. */
    packages: [1961, 2444, 3756],
    price: 5_490,
    date: '2026-09-03',
  },
  {
    name: 'Харьков Артем',
    walletId: 1245,
    studentId: 164,
    /**
     * 1 667 + 1 607 + 1 667 + 490. Третий взнос менеджер завёл 04.09 задним числом
     * продуктом «Доплата депозита», а второй стоит 1 607 ₽ вместо 1 667 ₽.
     * Подтвердит школа опечатку — пакет пересчитается на 5 490 ₽ @1 372 ₽.
     */
    packages: [2513, 2643, 3778, 3827],
    price: 5_431,
    date: '2026-09-06',
  },
]

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`
const unitOf = (price: number) => Math.floor(price / LESSONS)

async function show(title: string) {
  console.log(`\n── ${title} ──`)
  for (const t of TARGETS) {
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { id: t.walletId },
      select: { lessonsBalance: true },
    })
    const packages = await prisma.package.findMany({
      where: { walletId: t.walletId },
      select: {
        id: true,
        productName: true,
        lessonCount: true,
        remaining: true,
        price: true,
        unitPrice: true,
        status: true,
      },
      orderBy: { id: 'asc' },
    })
    const entries = await prisma.walletEntry.findMany({
      where: { walletId: t.walletId },
      select: { quantity: true, packageId: true },
    })
    const total = entries.reduce((sum, e) => sum + e.quantity, 0)

    console.log(
      `  ${t.name} (кош. ${t.walletId}): баланс ${wallet.lessonsBalance}, Σ журнала ${total}`,
    )
    for (const p of packages) {
      if (p.status === 'CANCELLED') continue
      console.log(
        `    пакет ${p.id}: ${p.lessonCount} зан. ост.${p.remaining} ` +
          `${rub(p.price)} @${rub(p.unitPrice)}  ${p.productName || '—'}`,
      )
    }

    // Те же инварианты, что у check-ledger, но сразу и по адресу.
    const broken: string[] = []
    if (total !== wallet.lessonsBalance) broken.push(`Σ ${total} ≠ баланс ${wallet.lessonsBalance}`)
    for (const p of packages) {
      const sum = entries.filter((e) => e.packageId === p.id).reduce((a, e) => a + e.quantity, 0)
      if (sum !== p.remaining) broken.push(`пакет ${p.id}: Σ ${sum} ≠ остаток ${p.remaining}`)
    }
    console.log(
      broken.length === 0 ? '      инварианты сходятся ✓' : `      ✗ ${broken.join('; ')}`,
    )
  }
}

async function main() {
  await show('Сейчас')

  let todo = 0
  let revenue = 0

  for (const t of TARGETS) {
    const packages = await prisma.package.findMany({
      where: { id: { in: t.packages }, walletId: t.walletId },
      select: { id: true, price: true, status: true },
    })
    // Список пакетов — руками, и ошибка в нём тихо сместила бы сумму нового
    // пакета. Сверяем и состав, и итог.
    assert.equal(
      packages.length,
      t.packages.length,
      `${t.name}: пакеты списка не нашлись на кошельке`,
    )
    const sum = packages.reduce((acc, p) => acc + p.price, 0)
    assert.equal(sum, t.price, `${t.name}: взносы дают ${sum}, а в списке ${t.price}`)

    if (packages.every((p) => p.status === 'CANCELLED')) {
      console.log(`\n${t.name}: уже исправлено`)
      continue
    }
    todo += 1

    const unit = unitOf(t.price)
    console.log(`\n${t.name}:`)
    console.log(
      `  ${t.packages.length} пакетов на ${rub(t.price)} → один «4 занятия» ` +
        `${rub(t.price)} @${rub(unit)} от ${t.date}`,
    )

    const charged = await prisma.attendance.findMany({
      where: { packageId: { in: t.packages }, price: { not: null } },
      select: { price: true, amount: true, lesson: { select: { date: true } } },
      orderBy: { lesson: { date: 'asc' } },
    })
    for (const a of charged) {
      const delta = (unit - (a.price ?? 0)) * a.amount
      revenue += delta
      console.log(
        `  занятие ${a.lesson.date}: ${rub(a.price ?? 0)} → ${rub(unit)} (${delta > 0 ? '+' : ''}${rub(delta)})`,
      )
    }
    console.log(`  баланс станет ${LESSONS - charged.length}`)
  }

  if (todo === 0) {
    console.log('\nПравить нечего.')
    await prisma.$disconnect()
    return
  }
  console.log(`\nКошельков к правке: ${todo}. Выручка: ${revenue >= 0 ? '+' : ''}${rub(revenue)}`)

  if (!APPLY) {
    console.log('\n— прогон вхолостую. Записать: --apply')
    await prisma.$disconnect()
    return
  }

  for (const t of TARGETS) {
    await prisma.$transaction(async (tx) => {
      const packages = await tx.package.findMany({
        where: { id: { in: t.packages }, walletId: t.walletId },
        select: { id: true, status: true, paymentId: true },
      })
      if (packages.every((p) => p.status === 'CANCELLED')) return

      // 1. Снять списания: урок возвращается на старый пакет, цена уходит в null,
      //    и занятие снова попадает под UNPAID_ATTENDANCE_WHERE.
      const charged = await tx.attendance.findMany({
        where: { packageId: { in: t.packages }, price: { not: null } },
        select: { id: true },
      })
      for (const attendance of charged) {
        await unchargeAttendanceTx(tx, {
          attendanceId: attendance.id,
          organizationId: ORGANIZATION_ID,
          actorUserId: MANAGER_ID,
          meta: { fix: 'deposit-topup', walletId: t.walletId },
        })
      }

      // 2. Отменить пакеты вместе со счетами. Счёт не удаляется: его externalId —
      //    ключ идемпотентности опроса amoCRM, и без строки окно завело бы
      //    доплату второй раз.
      for (const packet of packages) {
        await cancelPackageTx(tx, {
          packageId: packet.id,
          organizationId: ORGANIZATION_ID,
          actorUserId: MANAGER_ID,
          effectiveAt: t.date,
        })
        if (packet.paymentId !== null) {
          await tx.payment.update({
            where: { id: packet.paymentId },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          })
        }
      }

      // 3. Один пакет вместо них. `received: true` выдаёт уроки тем же движением
      //    и подбирает занятие, которое только что осталось без оплаты.
      const created = await createPaymentWithPackageTx(tx, {
        organizationId: ORGANIZATION_ID,
        studentId: t.studentId,
        walletId: t.walletId,
        productId: PRODUCT_ID,
        lessonCount: LESSONS,
        price: t.price,
        date: t.date,
        managerId: MANAGER_ID,
        received: true,
        actorUserId: MANAGER_ID,
        meta: { fix: 'deposit-topup' },
      })
      assert.equal(
        created.settled,
        charged.length,
        `${t.name}: снято списаний ${charged.length}, а закрылось ${created.settled}`,
      )
    }, PAYMENT_TX_OPTIONS)
  }

  await show('После')

  for (const t of TARGETS) {
    const unit = unitOf(t.price)
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { id: t.walletId },
      select: { lessonsBalance: true },
    })
    const fresh = await prisma.package.findFirstOrThrow({
      where: { walletId: t.walletId, status: 'ACTIVE' },
      select: { id: true, lessonCount: true, remaining: true, price: true, unitPrice: true },
    })
    // `Attendance.walletId` у этих строк пустой — кошелёк находится через запись в
    // группу, — поэтому занятия ищем по пакету, а не по кошельку.
    const stale = await prisma.attendance.count({
      where: { packageId: fresh.id, price: { not: unit } },
    })
    const orphan = await prisma.attendance.count({
      where: { packageId: { in: t.packages } },
    })

    assert.equal(fresh.lessonCount, LESSONS, `${t.name}: в новом пакете не ${LESSONS} занятий`)
    assert.equal(fresh.price, t.price, `${t.name}: сумма нового пакета не та`)
    assert.equal(fresh.unitPrice, unit, `${t.name}: цена урока не та`)
    assert.equal(
      wallet.lessonsBalance,
      fresh.remaining,
      `${t.name}: баланс разошёлся с остатком пакета`,
    )
    assert.equal(stale, 0, `${t.name}: остались занятия по старой цене`)
    assert.equal(orphan, 0, `${t.name}: занятия остались висеть на отменённых пакетах`)
  }

  console.log('\n— записано.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
