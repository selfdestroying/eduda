/**
 * Разовая правка: продукт, оплаченный двумя взносами и разложенный по занятиям
 * неверно.
 *
 * Школа берёт предоплату, а остаток добирает позже — и каждый взнос заводят
 * отдельным пакетом. Количество занятий при этом суммарно верное, а деньги ложатся
 * как попало: первый урок по 5 000 ₽, остальные по 911 или 1 350 ₽. Итог по
 * продукту сходится, но цена застывает в проводке каждого занятия, и в отчёте
 * получается ступенька.
 *
 * Реже ломается и количество: пакет несёт полную цену продукта, а выдаёт на урок
 * меньше — ученик недополучает занятие, за которое заплатил.
 *
 * ── Откуда берётся цена урока ────────────────────────────────────────────────
 *
 * Из суммы взносов, делённой на занятия продукта, — и каждый случай подтверждён
 * чужим пакетом с **той же суммой и тем же количеством**:
 *
 *   • год — 36 занятий за 36 900 ₽ = 1 025 ₽: три взноса по 12 300 у одного
 *     ученика, два по 18 450 у другого, 5 000 + 31 900 у третьего;
 *   • интенсивы — 10 400 ₽ за 5 (Голофат), 14 450 ₽ за 5 (Ситников, Кукушкин,
 *     Кузнецов, Плехов), 12 000 ₽ за 5 (Самоховец, Дурандин, Богданова).
 *
 * Медиана по ученику для этого не годится: у большинства есть и годовой курс, и
 * интенсив, а он дороже вдвое-втрое.
 *
 * ── Чего скрипт не трогает ───────────────────────────────────────────────────
 *
 * Деньги, лежащие в этих кошельках **сверх** года — предоплаты на 5 000 и 2 500 ₽,
 * заведённые как «1 занятие». Год у таких учеников собран отдельно и полностью, так
 * что эти суммы к нему не относятся: это те же деньги без курса, что и в кошельках
 * «Депозит». Сколько занятий они покрывают, из базы не выводится — решает школа.
 *
 * `Package.price` не меняется: это деньги, которые реально пришли. Меняется
 * `unitPrice` — цена, по которой урок признаётся выручкой. Расхождение между ними
 * («36 900 ₽ за пакет, 1 025 ₽ за урок») модель допускает: сумма хранится отдельно
 * именно потому, что деление даёт остаток.
 *
 *   pnpm --filter platform exec tsx scripts/fix-split-instalment-pricing.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/fix-split-instalment-pricing.ts --apply  # записать
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'

const APPLY = process.argv.includes('--apply')

const TARGETS = [
  {
    name: 'Егор Иванов',
    walletId: 1252,
    /** Год: 5 000 + 31 900 = 36 900 ₽ за 1 + 35 = 36 занятий. */
    packages: [2535, 2774],
    unit: 1_025,
    /** Количество верное — правим только цену. */
    lessons: null as number | null,
    expectBalance: 35,
  },
  {
    name: 'Вероника Иванова',
    walletId: 1251,
    /** Один пакет несёт всю годовую цену 36 900 ₽, но выдал 35 занятий вместо 36. */
    packages: [2773],
    unit: 1_025,
    lessons: 36,
    expectBalance: 37,
  },
  {
    name: 'Измаил Межерицкий',
    walletId: 1155,
    /** Интенсив: 5 000 + 5 400 = 10 400 ₽ за 5 занятий. Тот же пакет у Голофата. */
    packages: [1843, 2532],
    unit: 2_080,
    lessons: null,
    expectBalance: 0,
  },
  {
    name: 'Родион Лебедев',
    walletId: 1195,
    /** Тот же интенсив за 10 400 ₽, те же два взноса. */
    packages: [2007, 2577],
    unit: 2_080,
    lessons: null,
    expectBalance: 0,
  },
  {
    name: 'Чжан Роман',
    walletId: 1182,
    /** Интенсив: 5 000 + 9 450 = 14 450 ₽ за 5. Подтверждают четверо. */
    packages: [1948, 2504],
    unit: 2_890,
    lessons: null,
    expectBalance: 4,
  },
  {
    name: 'Анастасия Наурзалиева',
    walletId: 1236,
    /** Интенсив: 5 000 + 7 000 = 12 000 ₽ за 5. Подтверждают трое. */
    packages: [2492, 2654],
    unit: 2_400,
    lessons: null,
    expectBalance: 0,
  },
]

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

async function show(title: string) {
  console.log(`\n── ${title} ──`)
  for (const t of TARGETS) {
    const w = await prisma.wallet.findUniqueOrThrow({
      where: { id: t.walletId },
      select: { lessonsBalance: true },
    })
    const pk = await prisma.package.findMany({
      where: { walletId: t.walletId },
      select: { id: true, lessonCount: true, remaining: true, price: true, unitPrice: true },
      orderBy: { id: 'asc' },
    })
    const entries = await prisma.walletEntry.findMany({
      where: { walletId: t.walletId },
      select: { quantity: true, packageId: true },
    })
    const total = entries.reduce((a, e) => a + e.quantity, 0)
    console.log(`  ${t.name} (кош. ${t.walletId}): баланс ${w.lessonsBalance}, Σ журнала ${total}`)
    for (const p of pk) {
      const mine = t.packages.includes(p.id)
      console.log(
        `    ${mine ? '→' : ' '} пакет ${p.id}: ${p.lessonCount} зан. ост.${p.remaining} ` +
          `${rub(p.price)} @${rub(p.unitPrice)}`,
      )
    }
    // Инварианты — те же, что у check-ledger, но сразу и по адресу.
    const bad: string[] = []
    if (total !== w.lessonsBalance) bad.push(`Σ ${total} ≠ баланс ${w.lessonsBalance}`)
    for (const p of pk) {
      const sum = entries.filter((e) => e.packageId === p.id).reduce((a, e) => a + e.quantity, 0)
      if (sum !== p.remaining) bad.push(`пакет ${p.id}: Σ ${sum} ≠ остаток ${p.remaining}`)
    }
    console.log(bad.length === 0 ? '      инварианты сходятся ✓' : `      ✗ ${bad.join('; ')}`)
  }
}

async function main() {
  await show('Сейчас')

  let todo = 0
  let revenue = 0

  for (const t of TARGETS) {
    const pk = await prisma.package.findMany({
      where: { id: { in: t.packages } },
      select: { id: true, lessonCount: true, unitPrice: true, price: true },
      orderBy: { id: 'asc' },
    })
    const needsPrice = pk.some((p) => p.unitPrice !== t.unit)
    const needsCount = t.lessons !== null && pk.some((p) => p.lessonCount !== t.lessons)
    if (!needsPrice && !needsCount) {
      console.log(`\n${t.name}: уже исправлено`)
      continue
    }
    todo += 1

    console.log(`\n${t.name}:`)
    for (const p of pk) {
      const lessons = t.lessons ?? p.lessonCount
      console.log(
        `  пакет ${p.id}: ${p.lessonCount} зан. @${rub(p.unitPrice)} → ` +
          `${lessons} зан. @${rub(t.unit)}  (сумма ${rub(p.price)} не меняется)`,
      )
    }

    // Уже списанные занятия переоцениваются — это движение выручки.
    const charged = await prisma.attendance.findMany({
      where: { packageId: { in: t.packages }, price: { not: null } },
      select: { price: true, amount: true, lesson: { select: { date: true } } },
      orderBy: { lesson: { date: 'asc' } },
    })
    for (const a of charged) {
      const delta = (t.unit - (a.price ?? 0)) * a.amount
      revenue += delta
      console.log(
        `  занятие ${a.lesson.date}: ${rub(a.price ?? 0)} → ${rub(t.unit)} (${delta > 0 ? '+' : ''}${rub(delta)})`,
      )
    }
    if (charged.length === 0) console.log('  списанных занятий нет — выручка не двигается')
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

  await prisma.$transaction(async (tx) => {
    for (const t of TARGETS) {
      for (const id of t.packages) {
        const p = await tx.package.findUniqueOrThrow({
          where: { id },
          select: { lessonCount: true, remaining: true },
        })
        const lessons = t.lessons ?? p.lessonCount
        // Остаток двигается ровно на столько, на сколько выросло количество:
        // списанные занятия остаются списанными.
        const remaining = p.remaining + (lessons - p.lessonCount)

        await tx.package.update({
          where: { id },
          data: { lessonCount: lessons, remaining, unitPrice: t.unit },
        })
        await tx.walletEntry.updateMany({
          where: { packageId: id, kind: 'PURCHASE' },
          data: { quantity: lessons, unitPrice: t.unit },
        })
        // Цена в проводке занятия и в его строке журнала — всегда парой.
        await tx.attendance.updateMany({
          where: { packageId: id, price: { not: null } },
          data: { price: t.unit },
        })
        await tx.walletEntry.updateMany({
          where: { packageId: id, kind: 'CHARGE' },
          data: { unitPrice: t.unit },
        })

        // Баланс кошелька идёт следом за выданными уроками.
        if (lessons !== p.lessonCount) {
          await tx.wallet.update({
            where: { id: t.walletId },
            data: { lessonsBalance: { increment: lessons - p.lessonCount } },
          })
        }
      }
    }
  })

  await show('После')

  for (const t of TARGETS) {
    const w = await prisma.wallet.findUniqueOrThrow({
      where: { id: t.walletId },
      select: { lessonsBalance: true },
    })
    assert.equal(w.lessonsBalance, t.expectBalance, `у ${t.name} баланс не тот, что ожидали`)
  }

  console.log('\n— записано.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
