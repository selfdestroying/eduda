/**
 * Две правки поверх `fix-deposit-topup-packages.ts` — по тем же восьми кошелькам,
 * в тот же день.
 *
 * ── 1. Опечатка у Харькова ───────────────────────────────────────────────────
 *
 * Его депозит собирали тремя взносами по 1 667 ₽, но второй заведён как 1 607 ₽ —
 * одна цифра. Школа подтвердила: должно быть 1 667 ₽. Из-за этих 60 ₽ сумма
 * депозита вышла 5 431 ₽ вместо 5 490 ₽, и новый пакет получил 1 357 ₽ за урок
 * вместо 1 372 ₽, как у всех остальных.
 *
 * Правится и отменённый взнос (счёт с пакетом — деньги, которые пришли на самом
 * деле), и живой пакет с его счётом, занятием и строками журнала.
 *
 * `Wallet.totalPayments` при этом расходится на рубль: снятие старых пакетов
 * прошло по прежним суммам. Счётчик деньгами не считается (см. CLAUDE.md,
 * «Авансы» берут `Package.price`), и рубль в нём того не стоит.
 *
 * ── 2. Даты — 1 сентября ─────────────────────────────────────────────────────
 *
 * Первый скрипт датировал каждый новый пакет днём доплаты — днём, когда сумма
 * стала целой. Дни разъехались с 31.08 по 06.09, и восемь одинаковых по смыслу
 * пакетов оказались в двух месяцах. Ставим всем 01.09, как у Котовой: начало
 * учебного года, одна дата на весь разбор.
 *
 * Двигаются дата пакета, дата его счёта и `effectiveAt` строк, которые написал
 * первый скрипт: выдача нового пакета и отмены старых. `CHARGE` и `REVERSAL` не
 * трогаем — их бизнес-день это день занятия, и он не менялся.
 *
 * Журнал append-only, и правка строк — исключение: это те же строки, что скрипт
 * написал часом раньше, и правится в них дата события, которое не состоялось
 * в тот день.
 *
 *   pnpm --filter platform exec tsx scripts/fix-deposit-topup-followup.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/fix-deposit-topup-followup.ts --apply  # записать
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'

const APPLY = process.argv.includes('--apply')

/** Начало учебного года — общая дата всего разбора депозитов. */
const DATE = '2026-09-01'

const WALLETS = [
  { name: 'Сажин Елисей', walletId: 1027, packageId: 3832, old: [1359, 1728, 2149, 3759] },
  { name: 'Вознесенский Андрей', walletId: 1029, packageId: 3833, old: [1377, 1684, 2109, 3777] },
  { name: 'Сулимова Елена', walletId: 1114, packageId: 3834, old: [1688, 1730, 2180, 3754] },
  { name: 'Сенько Игорь', walletId: 1118, packageId: 3835, old: [1691, 3675] },
  { name: 'Михайлов Никита', walletId: 1149, packageId: 3836, old: [1820, 2424, 3826] },
  { name: 'Подшивалова Сабина', walletId: 1151, packageId: 3837, old: [1822, 2256, 3828] },
  { name: 'Технарев Матвей', walletId: 1184, packageId: 3838, old: [1961, 2444, 3756] },
  { name: 'Харьков Артем', walletId: 1245, packageId: 3839, old: [2513, 2643, 3778, 3827] },
]

/** Опечатка: взнос 1 607 ₽ вместо 1 667 ₽ и всё, что из неё вывелось. */
const TYPO = {
  name: 'Харьков Артем',
  /** Отменённый взнос: сумма, которая пришла на самом деле. */
  instalment: { packageId: 2643, price: 1_667 },
  /** Живой пакет: 1 667 + 1 607 + 1 667 + 490 → 1 667 × 3 + 490. */
  packageId: 3839,
  price: 5_490,
  unit: 1_372,
}

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

async function main() {
  // ── 1. Опечатка ────────────────────────────────────────────────────────────
  const instalment = await prisma.package.findUniqueOrThrow({
    where: { id: TYPO.instalment.packageId },
    select: { price: true, unitPrice: true, paymentId: true },
  })
  const fresh = await prisma.package.findUniqueOrThrow({
    where: { id: TYPO.packageId },
    select: { price: true, unitPrice: true, paymentId: true },
  })
  const typoDone = instalment.price === TYPO.instalment.price && fresh.unitPrice === TYPO.unit

  console.log(`\n── Опечатка · ${TYPO.name} ──`)
  if (typoDone) {
    console.log('  уже исправлено')
  } else {
    console.log(
      `  взнос ${TYPO.instalment.packageId}: ${rub(instalment.price)} → ${rub(TYPO.instalment.price)}`,
    )
    console.log(
      `  пакет ${TYPO.packageId}: ${rub(fresh.price)} @${rub(fresh.unitPrice)} → ` +
        `${rub(TYPO.price)} @${rub(TYPO.unit)}`,
    )
    const charged = await prisma.attendance.findMany({
      where: { packageId: TYPO.packageId, price: { not: null } },
      select: { price: true, amount: true, lesson: { select: { date: true } } },
    })
    for (const a of charged) {
      console.log(
        `  занятие ${a.lesson.date}: ${rub(a.price ?? 0)} → ${rub(TYPO.unit)} ` +
          `(+${rub((TYPO.unit - (a.price ?? 0)) * a.amount)})`,
      )
    }
  }

  // ── 2. Даты ────────────────────────────────────────────────────────────────
  console.log(`\n── Даты → ${DATE} ──`)
  let moves = 0
  for (const w of WALLETS) {
    const packet = await prisma.package.findUniqueOrThrow({
      where: { id: w.packageId },
      select: { date: true, walletId: true, paymentId: true },
    })
    assert.equal(packet.walletId, w.walletId, `${w.name}: пакет не с того кошелька`)
    if (packet.date === DATE) {
      console.log(`  ${w.name}: уже ${DATE}`)
      continue
    }
    moves += 1
    console.log(
      `  ${w.name}: пакет ${w.packageId} и счёт ${packet.paymentId} — ${packet.date} → ${DATE}`,
    )
  }

  if (typoDone && moves === 0) {
    console.log('\nПравить нечего.')
    await prisma.$disconnect()
    return
  }

  if (!APPLY) {
    console.log('\n— прогон вхолостую. Записать: --apply')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(async (tx) => {
    if (!typoDone) {
      // Отменённый взнос: деньги, которые пришли на самом деле.
      await tx.package.update({
        where: { id: TYPO.instalment.packageId },
        data: { price: TYPO.instalment.price, unitPrice: TYPO.instalment.price },
      })
      if (instalment.paymentId !== null) {
        await tx.payment.update({
          where: { id: instalment.paymentId },
          data: { price: TYPO.instalment.price },
        })
      }
      await tx.walletEntry.updateMany({
        where: { packageId: TYPO.instalment.packageId },
        data: { unitPrice: TYPO.instalment.price },
      })

      // Живой пакет: сумма, цена урока, проводка занятия и строки журнала — вместе,
      // иначе check-ledger разведёт выручку журнала с выручкой строк.
      await tx.package.update({
        where: { id: TYPO.packageId },
        data: { price: TYPO.price, unitPrice: TYPO.unit },
      })
      if (fresh.paymentId !== null) {
        await tx.payment.update({ where: { id: fresh.paymentId }, data: { price: TYPO.price } })
      }
      await tx.attendance.updateMany({
        where: { packageId: TYPO.packageId, price: { not: null } },
        data: { price: TYPO.unit },
      })
      await tx.walletEntry.updateMany({
        where: { packageId: TYPO.packageId },
        data: { unitPrice: TYPO.unit },
      })
    }

    for (const w of WALLETS) {
      const packet = await tx.package.findUniqueOrThrow({
        where: { id: w.packageId },
        select: { date: true, paymentId: true },
      })
      if (packet.date === DATE) continue

      await tx.package.update({ where: { id: w.packageId }, data: { date: DATE } })
      if (packet.paymentId !== null) {
        await tx.payment.update({ where: { id: packet.paymentId }, data: { date: DATE } })
      }
      // Выдача нового пакета и отмены старых — события одного разбора, и день у
      // них общий. Списание и его откат живут днём занятия и остаются на месте.
      await tx.walletEntry.updateMany({
        where: { packageId: w.packageId, kind: 'PURCHASE' },
        data: { effectiveAt: DATE },
      })
      await tx.walletEntry.updateMany({
        where: { packageId: { in: w.old }, kind: 'CANCELLATION' },
        data: { effectiveAt: DATE },
      })
    }
  })

  console.log('\n── После ──')
  for (const w of WALLETS) {
    const packet = await prisma.package.findUniqueOrThrow({
      where: { id: w.packageId },
      select: {
        date: true,
        price: true,
        unitPrice: true,
        remaining: true,
        payment: { select: { date: true } },
      },
    })
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { id: w.walletId },
      select: { lessonsBalance: true },
    })
    const entries = await prisma.walletEntry.findMany({
      where: { walletId: w.walletId },
      select: { quantity: true, kind: true, effectiveAt: true, packageId: true },
    })
    const total = entries.reduce((sum, e) => sum + e.quantity, 0)
    const strays = entries.filter(
      (e) =>
        (e.kind === 'PURCHASE' && e.packageId === w.packageId && e.effectiveAt !== DATE) ||
        (e.kind === 'CANCELLATION' && e.effectiveAt !== DATE),
    ).length

    console.log(
      `  ${w.name}: пакет ${w.packageId} от ${packet.date}, счёт от ${packet.payment?.date}, ` +
        `${rub(packet.price)} @${rub(packet.unitPrice)}, ост.${packet.remaining}, баланс ${wallet.lessonsBalance}`,
    )

    assert.equal(packet.date, DATE, `${w.name}: дата пакета не ${DATE}`)
    assert.equal(packet.payment?.date, DATE, `${w.name}: дата счёта не ${DATE}`)
    assert.equal(strays, 0, `${w.name}: строки разбора остались не на ${DATE}`)
    assert.equal(total, wallet.lessonsBalance, `${w.name}: Σ журнала разошлась с балансом`)
    assert.equal(packet.remaining, wallet.lessonsBalance, `${w.name}: остаток разошёлся с балансом`)
  }

  const typoPackage = await prisma.package.findUniqueOrThrow({
    where: { id: TYPO.packageId },
    select: { price: true, unitPrice: true },
  })
  const typoStale = await prisma.attendance.count({
    where: { packageId: TYPO.packageId, price: { not: TYPO.unit } },
  })
  assert.equal(typoPackage.price, TYPO.price, 'у Харькова сумма пакета не та')
  assert.equal(typoPackage.unitPrice, TYPO.unit, 'у Харькова цена урока не та')
  assert.equal(typoStale, 0, 'у Харькова остались занятия по старой цене')

  console.log('\n— записано.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
