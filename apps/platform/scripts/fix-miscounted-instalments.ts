/**
 * Разовая правка: взнос, заведённый с неверным количеством занятий.
 *
 * Та же ошибка ввода, что у Максима Калинцева (`fix-wallet-17-subscription.ts`): в
 * форме поправили количество, а сумму оставили от продукта — и весь платёж лёг не
 * на то число уроков. Дальше она размножается сама: пакет исчерпывается раньше
 * срока, следующие занятия уходят «в долг» по той же задранной цене, а бэкфилл
 * перехода закрывает недостачу снимком остатка.
 *
 * ── Откуда берётся правильное количество ─────────────────────────────────────
 *
 * Не из медианы — она врёт, если ученик ходит и на годовой курс, и на интенсив.
 * У каждого случая своё доказательство, и оно указано в комментарии рядом:
 *
 *   • **интенсив, группа 206** — двое учеников на одном продукте заплатили по
 *     7 990 ₽, и у обоих в этой группе ровно пять строк посещаемости. Значит пять
 *     занятий, 1 598 ₽ за урок, делится без остатка;
 *   • **два интенсива подряд** — количество задано расписанием: две группы по пять
 *     занятий, пять из них уже закрыты соседним пакетом;
 *   • **годовой абонемент** — рядом лежит второй платёж на ту же сумму с верным
 *     количеством, и снимок перехода равен ровно недостаче.
 *
 * ── Что делает скрипт ────────────────────────────────────────────────────────
 *
 *   1. Занятия по 7 990 ₽ переоцениваются в 1 598 ₽ — вместе со строками журнала.
 *   2. Занятия, ушедшие «в долг» (пакет исчерпался первым же уроком), привязываются
 *      к своему взносу: долга не было, они им и оплачены.
 *   3. Взнос становится «5 занятий», приход в журнале — +5.
 *   4. Строка сальдо обнуляется: долг, который она закрывала, не существует.
 *   5. Снимок остатка, если бэкфилл его завёл, обнуляется — урок, который он
 *      держал, теперь лежит во взносе, где ему и место.
 *
 * ── Про баланс ───────────────────────────────────────────────────────────────
 *
 * Он НЕ обязан уходить в ноль. У Андреева пятый день интенсива — предупреждённый
 * пропуск, а такое занятие денег не стоит: урок остаётся неистраченным. После
 * правки он лежит во взносе 1554 (остаток 1), а не в снимке перехода — то есть за
 * ним стоят настоящие деньги, а не ноль. У Кукушкина отходили все пять, остаток 0.
 *
 * Снимок обнуляется, а не отменяется через `cancelPackageTx`: отмена сняла бы урок
 * с баланса, а его надо не снять, а переложить в правильный пакет. Обе строки —
 * и снимок, и сальдо — написал бэкфилл 30.08.2026 одним заходом, журнала до
 * перехода не существовало.
 *
 *   pnpm --filter platform exec tsx scripts/fix-miscounted-instalments.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/fix-miscounted-instalments.ts --apply  # записать
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'

const APPLY = process.argv.includes('--apply')

const TARGETS = [
  {
    name: 'Андрей Кукушкин',
    studentId: 156,
    walletId: 1093,
    /** Взнос за интенсив, заведённый как одно занятие. */
    instalment: 2033,
    /** Снимок остатка от бэкфилла — если он в этом кошельке есть. */
    snapshot: null as number | null,
    bad: 7_990,
    unit: 1_598,
    lessons: 5,
    /** Сколько занятий интенсива оплачиваемые (остальные — предупреждённые пропуски). */
    expectCharged: 5,
  },
  {
    name: 'Михаил Андреев',
    studentId: 128,
    walletId: 1068,
    instalment: 1554,
    snapshot: 3065,
    bad: 7_990,
    unit: 1_598,
    lessons: 5,
    expectCharged: 4,
  },
  {
    // Ходил на два интенсива сразу — группы 219 (09:00) и 220 (14:00), одна
    // неделя, по пять занятий. Соседний пакет 1656 закрыл первые пять, значит
    // этому взносу остаются вторые пять, а не все десять. 9 450 ÷ 5 = 1 890 ровно.
    //
    // Перекрёстно цену здесь не проверить: единого прайса на интенсивы у школы
    // нет, в этих же группах ученики платят от 850 до 3 200 ₽ за урок. Зато
    // количество задано расписанием, а не ценой.
    name: 'Егор Стафеев',
    studentId: 330,
    walletId: 1100,
    instalment: 1835,
    snapshot: null,
    bad: 9_450,
    unit: 1_890,
    lessons: 5,
    expectCharged: 5,
  },
  {
    // Годовой абонемент, два платежа по 19 750 ₽: первый (1832) дал 18 занятий,
    // второй — 12. Продукт подтверждают другие ученики: «Оплата года 26/27» это
    // 18 занятий за 19 750 ₽ = 1 097 ₽/урок. А снимок перехода на 6 уроков — это
    // ровно недостача второго взноса, 18 − 12.
    //
    // Занятий по 1 645 ₽ не списано ни одного: правка целиком вперёд.
    name: 'Максим Волков',
    studentId: 119,
    walletId: 1154,
    instalment: 2253,
    snapshot: 3072,
    bad: 1_645,
    unit: 1_097,
    lessons: 18,
    expectCharged: 0,
  },
]

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

type Target = (typeof TARGETS)[number]

/** Инварианты кошелька — те же, что сверяет `check-ledger`, но по одному адресу. */
async function audit(client: typeof prisma, t: Target) {
  const wallet = await client.wallet.findUniqueOrThrow({
    where: { id: t.walletId },
    select: { lessonsBalance: true },
  })
  const packages = await client.package.findMany({
    where: { walletId: t.walletId },
    select: {
      id: true,
      status: true,
      lessonCount: true,
      remaining: true,
      price: true,
      unitPrice: true,
    },
    orderBy: { id: 'asc' },
  })
  const entries = await client.walletEntry.findMany({
    where: { walletId: t.walletId },
    select: { quantity: true, packageId: true },
  })
  const total = entries.reduce((a, e) => a + e.quantity, 0)

  const problems: string[] = []
  if (total !== wallet.lessonsBalance) {
    problems.push(`Σ журнала ${total} ≠ баланс ${wallet.lessonsBalance}`)
  }
  for (const p of packages) {
    const sum = entries.filter((e) => e.packageId === p.id).reduce((a, e) => a + e.quantity, 0)
    if (sum !== p.remaining) problems.push(`пакет ${p.id}: Σ ${sum} ≠ остаток ${p.remaining}`)
  }
  return { wallet, packages, total, problems }
}

async function show(client: typeof prisma, t: Target, title: string) {
  const { wallet, packages, total, problems } = await audit(client, t)
  console.log(`  ${title}: баланс ${wallet.lessonsBalance}, Σ журнала ${total}`)
  for (const p of packages) {
    console.log(
      `    пакет ${p.id} ${p.status.padEnd(9)} ${p.lessonCount} зан. ост.${p.remaining} ` +
        `${rub(p.price)} @${rub(p.unitPrice)}`,
    )
  }
  console.log(problems.length === 0 ? '    инварианты сходятся ✓' : `    ✗ ${problems.join('; ')}`)
  return problems
}

async function main() {
  let removed = 0
  /** Сколько взносов ждёт правки. Считаем их, а не снятую выручку: у взноса,
   *  по которому ещё не списывали, выручка не двигается, а править его надо. */
  let todo = 0

  for (const t of TARGETS) {
    const charged = await prisma.attendance.findMany({
      where: { studentId: t.studentId, price: t.bad },
      select: { id: true, packageId: true, lesson: { select: { date: true } } },
      orderBy: { lesson: { date: 'asc' } },
    })

    console.log(`\n${'='.repeat(66)}\n${t.name} · кошелёк ${t.walletId}`)
    await show(prisma, t, 'сейчас')

    // Признак «уже исправлено» — количество во взносе, а не наличие занятий по
    // старой цене: у Волкова по ней не списано ни одного, и правка всё равно нужна.
    const instalment = await prisma.package.findUniqueOrThrow({
      where: { id: t.instalment },
      select: { lessonCount: true },
    })
    if (instalment.lessonCount === t.lessons) {
      console.log('  уже исправлено')
      continue
    }

    const debt = charged.filter((a) => a.packageId === null)
    console.log(`\n  занятий по ${rub(t.bad)}: ${charged.length}, из них «в долг» ${debt.length}`)
    for (const a of charged) {
      console.log(
        `    ${a.lesson.date}  ${rub(t.bad)} → ${rub(t.unit)}` +
          (a.packageId === null ? `  · привязать к пакету ${t.instalment}` : ''),
      )
    }
    todo += 1
    console.log(
      `\n  пакет ${t.instalment}: ${instalment.lessonCount} зан. → ${t.lessons} зан. ` +
        `@${rub(t.unit)}, остаток ${t.lessons - charged.length}`,
    )
    if (t.snapshot) console.log(`  снимок ${t.snapshot}: обнуляется, уроки переходят во взнос`)

    const delta = charged.length * (t.bad - t.unit)
    removed += delta
    console.log(
      delta > 0
        ? `  выручка: снимается ${rub(delta)}`
        : '  выручка закрытых месяцев не двигается: по старой цене не списано ничего',
    )

    assert.equal(
      charged.length,
      t.expectCharged,
      `ожидалось ${t.expectCharged} занятий у ${t.name}`,
    )
  }

  if (todo === 0) {
    console.log('\nПравить нечего.')
    await prisma.$disconnect()
    return
  }
  console.log(`\nВзносов к правке: ${todo}. Снимается выручки: ${rub(removed)}`)

  if (!APPLY) {
    console.log('\n— прогон вхолостую. Записать: --apply')
    await prisma.$disconnect()
    return
  }

  for (const t of TARGETS) {
    const charged = await prisma.attendance.findMany({
      where: { studentId: t.studentId, price: t.bad },
      select: { id: true, packageId: true },
    })
    // Тот же признак, что в сводке: смотрим на взнос, а не на занятия.
    const instalment = await prisma.package.findUniqueOrThrow({
      where: { id: t.instalment },
      select: { lessonCount: true },
    })
    if (instalment.lessonCount === t.lessons) continue

    const ids = charged.map((a) => a.id)
    const debtIds = charged.filter((a) => a.packageId === null).map((a) => a.id)

    await prisma.$transaction(async (tx) => {
      // 1. Цена занятия и цена в его строке журнала — всегда парой.
      await tx.attendance.updateMany({ where: { id: { in: ids } }, data: { price: t.unit } })
      await tx.walletEntry.updateMany({
        where: { attendanceId: { in: ids }, walletId: t.walletId },
        data: { unitPrice: t.unit },
      })

      // 2. Долга не было: эти занятия оплачены взносом.
      await tx.attendance.updateMany({
        where: { id: { in: debtIds } },
        data: { packageId: t.instalment },
      })
      await tx.walletEntry.updateMany({
        where: { attendanceId: { in: debtIds }, walletId: t.walletId },
        data: { packageId: t.instalment, comment: null },
      })

      // 3. Взнос содержал пять занятий, а не одно.
      await tx.package.update({
        where: { id: t.instalment },
        data: {
          lessonCount: t.lessons,
          unitPrice: t.unit,
          remaining: t.lessons - charged.length,
        },
      })
      await tx.walletEntry.updateMany({
        where: { packageId: t.instalment, kind: 'PURCHASE' },
        data: { quantity: t.lessons, unitPrice: t.unit },
      })

      // 4. Сальдо закрывало долг, которого не было.
      await tx.walletEntry.updateMany({
        where: { walletId: t.walletId, kind: 'ADJUSTMENT' },
        data: { quantity: 0, comment: 'Сальдо снято: долг закрыт взносом за интенсив' },
      })

      // 5. Снимок держал урок, который лежит во взносе. Обнуляем, а не отменяем:
      //    отмена сняла бы урок с баланса, а его надо переложить.
      if (t.snapshot) {
        await tx.package.update({
          where: { id: t.snapshot },
          data: { status: 'CANCELLED', cancelledAt: new Date(), remaining: 0, unitPrice: t.unit },
        })
        await tx.walletEntry.updateMany({
          where: { packageId: t.snapshot, kind: 'PURCHASE' },
          data: { quantity: 0, comment: 'Снимок снят: урок учтён во взносе за интенсив' },
        })
      }
    })

    const problems = await show(prisma, t, `после (${t.name})`)
    assert.equal(problems.length, 0, `инварианты кошелька ${t.walletId} разошлись`)
  }

  console.log('\n— записано.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
