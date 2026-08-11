/**
 * Чинит оплаты, у которых при заведении перепутали местами сумму и количество:
 * «4 ₽ за 5390 занятий» вместо «5390 ₽ за 4 занятия».
 *
 * Такая строка одна отдаёт тысячи фиктивных уроков остатка и делает сотню занятий
 * бесплатными, поэтому чинить её надо до разметки истории
 * (`backfill-payment-packets.ts`) — иначе разметка разложит по пакетам чепуху.
 *
 * Признак берём узкий и однозначный: уроков больше 50 и при этом меньше рублей,
 * чем уроков. Настоящих абонементов на 50+ занятий в базе нет.
 *
 *   pnpm --filter platform exec tsx scripts/fix-swapped-payments.ts          # вхолостую
 *   pnpm --filter platform exec tsx scripts/fix-swapped-payments.ts --apply  # записать
 */
import './load-env'

import { prisma } from '@repo/db'

const apply = process.argv.includes('--apply')

async function main() {
  const broken = await prisma.payment.findMany({
    where: { lessonCount: { gt: 50 } },
    select: {
      id: true,
      studentId: true,
      walletId: true,
      date: true,
      price: true,
      lessonCount: true,
      bidForLesson: true,
    },
    orderBy: { id: 'asc' },
  })

  const swapped = broken.filter((p) => p.price < p.lessonCount)
  const skipped = broken.filter((p) => p.price >= p.lessonCount)

  console.log(`Оплат с количеством уроков больше 50: ${broken.length}`)
  console.log(`Из них с перепутанными полями: ${swapped.length}`)
  for (const p of swapped) {
    console.log(
      `  #${p.id} ученик ${p.studentId} ${p.date}: ${p.price} ₽ / ${p.lessonCount} ур.` +
        `  →  ${p.lessonCount} ₽ / ${p.price} ур.`,
    )
  }
  for (const p of skipped) {
    console.log(`  #${p.id}: ${p.price} ₽ / ${p.lessonCount} ур. — не трогаем, похоже на правду`)
  }

  if (swapped.length === 0) {
    console.log('\nЧинить нечего.')
    await prisma.$disconnect()
    return
  }

  // Копия «как было» — на случай, если правило окажется слишком широким.
  console.log('\nБыло (для отката):')
  console.log(
    JSON.stringify(
      swapped.map((p) => ({
        id: p.id,
        price: p.price,
        lessonCount: p.lessonCount,
        bidForLesson: p.bidForLesson,
      })),
    ),
  )

  if (!apply) {
    console.log('\nПрогон вхолостую. Записать: --apply')
    await prisma.$disconnect()
    return
  }

  for (const p of swapped) {
    await prisma.payment.update({
      where: { id: p.id },
      data: {
        price: p.lessonCount,
        lessonCount: p.price,
        bidForLesson: p.price > 0 ? Math.floor(p.lessonCount / p.price) : 0,
      },
    })
  }

  console.log(`\nПочинено оплат: ${swapped.length}`)
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
