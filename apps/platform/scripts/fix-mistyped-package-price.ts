/**
 * Разовая правка: опечатка в сумме пакета.
 *
 * Два пакета заведены с суммой в сотню раз меньше настоящей — «4 занятия за 54 ₽»
 * и «8 занятий за 8 ₽». Количество занятий у обоих верное, сломана только сумма, и
 * из неё вывелась цена урока: 13 ₽ и 1 ₽. Занятия по ним уже списались, то есть в
 * отчётах эти двенадцать уроков стоят школе шестьдесят рублей вместо одиннадцати
 * тысяч.
 *
 * ── Откуда берутся настоящие суммы ───────────────────────────────────────────
 *
 * Из соседей по кошельку — того же продукта, того же количества занятий:
 *
 *   • Юлия Смирнова: четыре соседних пакета (515, 881, 1167, 1670) — все
 *     «4 занятия за 5 490 ₽ = 1 372 ₽/урок», и все её остальные занятия идут по
 *     1 372 ₽. «54» — это «5 490» с потерянными цифрами;
 *   • Алексей Кирсанов: сосед 1223 — «8 занятий за 5 500 ₽ = 687 ₽/урок», и все
 *     его остальные занятия идут по 687 ₽. 5 500 ÷ 8 = 687 ровно. Похоже, в поле
 *     суммы попало количество.
 *
 * Цена урока выводится твёрдо — она совпадает и с соседними пакетами, и со всеми
 * прочими занятиями этих учеников. Сама сумма (5 490 и 5 500) взята по соседям:
 * подтвердить её может только школа, это деньги, которые реально приходили.
 *
 * ── Что правится ─────────────────────────────────────────────────────────────
 *
 * Сумма счёта и пакета, цена урока, цена в каждом списанном занятии и `unitPrice`
 * в каждой строке журнала — всё разом, иначе `check-ledger.ts` разведёт «выручку по
 * журналу» с «выручкой по строкам».
 *
 * Количество занятий, остатки и баланс не двигаются: сломана была только цена.
 * Выручка закрытых месяцев — двигается, вверх: занятия, признанные почти
 * бесплатными, начинают стоить сколько стоили.
 *
 * Строки журнала написал бэкфилл 30.08.2026 — журнала до перехода не существовало,
 * так что append-only здесь не нарушается: это правка разовой заливки истории.
 *
 *   pnpm --filter platform exec tsx scripts/fix-mistyped-package-price.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/fix-mistyped-package-price.ts --apply  # записать
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'

const APPLY = process.argv.includes('--apply')

const TARGETS = [
  {
    name: 'Юлия Смирнова',
    packageId: 618,
    /** Соседи 515, 881, 1167, 1670 — все «4 занятия за 5 490 ₽». */
    price: 5_490,
    unit: 1_372,
    expectLessons: 4,
  },
  {
    name: 'Алексей Кирсанов',
    packageId: 1679,
    /** Сосед 1223 — «8 занятий за 5 500 ₽»; 5 500 ÷ 8 = 687 ровно. */
    price: 5_500,
    unit: 687,
    expectLessons: 8,
  },
]

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

async function main() {
  let before = 0
  let after = 0
  let todo = 0

  for (const t of TARGETS) {
    const p = await prisma.package.findUniqueOrThrow({
      where: { id: t.packageId },
      select: {
        lessonCount: true,
        remaining: true,
        price: true,
        unitPrice: true,
        paymentId: true,
        payment: { select: { price: true } },
        student: { select: { firstName: true, lastName: true } },
      },
    })

    console.log(`\n${t.name} · пакет ${t.packageId}`)

    if (p.price === t.price && p.unitPrice === t.unit) {
      console.log('  уже исправлено')
      continue
    }
    todo += 1

    const att = await prisma.attendance.findMany({
      where: { packageId: t.packageId },
      select: { price: true, amount: true, lesson: { select: { date: true } } },
      orderBy: { lesson: { date: 'asc' } },
    })

    console.log(
      `  пакет: ${p.lessonCount} зан., ${rub(p.price)} @${rub(p.unitPrice)} → ` +
        `${rub(t.price)} @${rub(t.unit)}`,
    )
    console.log(`  счёт ${p.paymentId}: ${rub(p.payment?.price ?? 0)} → ${rub(t.price)}`)
    console.log(`  занятий списано: ${att.length}`)

    const months = new Map<string, { n: number; before: number; after: number }>()
    for (const a of att) {
      const key = a.lesson.date.slice(0, 7)
      const cur = months.get(key) ?? { n: 0, before: 0, after: 0 }
      cur.n += 1
      cur.before += (a.price ?? 0) * a.amount
      cur.after += t.unit * a.amount
      months.set(key, cur)
    }
    for (const [month, v] of [...months].sort()) {
      console.log(
        `    ${month}: ${v.n} зан., ${rub(v.before)} → ${rub(v.after)}  (+${rub(v.after - v.before)})`,
      )
      before += v.before
      after += v.after
    }

    // Количество не трогаем — сломана была только цена. Если оно вдруг другое,
    // значит случай не тот, и писать нельзя.
    assert.equal(p.lessonCount, t.expectLessons, `у ${t.name} ожидалось ${t.expectLessons} занятий`)
    assert.equal(att.length, t.expectLessons, `списано занятий не столько, сколько в пакете`)
  }

  if (todo === 0) {
    console.log('\nПравить нечего.')
    await prisma.$disconnect()
    return
  }

  console.log(
    `\nВыручка закрытых месяцев: ${rub(before)} → ${rub(after)} (добавляется ${rub(after - before)})`,
  )

  if (!APPLY) {
    console.log('\n— прогон вхолостую. Записать: --apply')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(async (tx) => {
    for (const t of TARGETS) {
      const p = await tx.package.findUniqueOrThrow({
        where: { id: t.packageId },
        select: { price: true, unitPrice: true, paymentId: true },
      })
      if (p.price === t.price && p.unitPrice === t.unit) continue

      // Деньги: счёт и пакет — одна и та же сумма, заведены парой.
      if (p.paymentId !== null) {
        await tx.payment.update({ where: { id: p.paymentId }, data: { price: t.price } })
      }
      await tx.package.update({
        where: { id: t.packageId },
        data: { price: t.price, unitPrice: t.unit },
      })

      // Цена в проводках занятий и в строках журнала — всегда вместе.
      await tx.attendance.updateMany({
        where: { packageId: t.packageId },
        data: { price: t.unit },
      })
      await tx.walletEntry.updateMany({
        where: { packageId: t.packageId },
        data: { unitPrice: t.unit },
      })
    }
  })

  for (const t of TARGETS) {
    const p = await prisma.package.findUniqueOrThrow({
      where: { id: t.packageId },
      select: { price: true, unitPrice: true, payment: { select: { price: true } } },
    })
    const stale = await prisma.attendance.count({
      where: { packageId: t.packageId, price: { not: t.unit } },
    })
    console.log(
      `  ${t.name}: пакет ${rub(p.price)} @${rub(p.unitPrice)}, счёт ${rub(p.payment?.price ?? 0)}, ` +
        `занятий со старой ценой ${stale}`,
    )
    assert.equal(stale, 0, `у ${t.name} остались занятия со старой ценой`)
  }

  console.log('\n— записано.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
