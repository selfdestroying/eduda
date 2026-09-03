/**
 * Разовая правка одного кошелька: третий взнос абонемента Максима Калинцева.
 *
 * Годовой абонемент «ЭИ 36 занятий, разбивка на 3 платежа», кошелёк 17. Первые два
 * взноса заведены правильно — по 12 занятий за 12 900 ₽. Третий (пакет 1939,
 * 15.04.2026) заведён как **1 занятие за 11 834 ₽**: в форме поправили количество,
 * а сумму оставили от продукта.
 *
 * До конца года оставалось девять занятий, и они прошли так: первое списалось с
 * пакета 1939 и исчерпало его, остальные восемь ушли «в долг» — пакетов в кошельке
 * больше не было. Бэкфилл перехода закрыл этот долг разметкой: завёл пакет остатка
 * 2845 на девять уроков и строку сальдо на +8.
 *
 * Год закончен 25.05.2026, ученик отходил всё. Значит правда такая: **пакет 1939
 * содержал девять занятий**, все они проведены, на балансе не должно остаться
 * ничего. Разметка перехода описывала состояние, которого не было.
 *
 * ── Что делает скрипт ────────────────────────────────────────────────────────
 *
 *   1. Восемь «долговых» посещений привязываются к пакету 1939 — вместе со своими
 *      строками журнала. Долга не было: занятия оплачены этим взносом.
 *   2. Пакет 1939 становится «9 занятий», приход в журнале — +9.
 *   3. Строка сальдо +8 обнуляется: долг, который она закрывала, не существует.
 *   4. Пакет остатка 2845 отменяется штатным `cancelPackageTx` — со встречной
 *      строкой в журнале, а не втихую. Баланс уходит в ноль.
 *
 * Цена урока остаётся 1 075 ₽ — та же, что у двух других взносов и что уже стоит
 * на всех 33 занятиях ученика (её проставил `fix-inflated-debt-lesson-prices.ts`).
 * Делить взнос на девять дало бы 1 314 ₽, но тогда один и тот же абонемент шёл бы
 * по двум разным ценам.
 *
 * ── Что остаётся неразнесённым ───────────────────────────────────────────────
 *
 * 15 000 ₽ в пакете «Оплачено до перехода» (0 занятий) и 2 159 ₽ разницы между
 * взносом 11 834 ₽ и девятью уроками по 1 075 ₽. Это деньги, полученные за
 * занятия, которых в году не оказалось. Выручкой они не признаются, и признать их
 * — отдельное решение школы.
 *
 * Строки журнала, которые скрипт правит, написал бэкфилл 30.08.2026 одним заходом:
 * журнала до перехода не существовало. Живые записи не редактируются — отмена
 * пакета идёт встречной строкой, как и положено.
 *
 *   pnpm --filter platform exec tsx scripts/fix-wallet-17-subscription.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/fix-wallet-17-subscription.ts --apply  # записать
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import { cancelPackageTx } from '../src/features/finances/ledger.server'
import { todayYmdInTz } from '../src/lib/timezone'

const APPLY = process.argv.includes('--apply')

const WALLET = 17
const STUDENT = 354
/** Третий взнос абонемента: должен был содержать оставшиеся занятия. */
const INSTALMENT = 1939
/** Снимок остатка, который завёл бэкфилл на месте недовыданных занятий. */
const SNAPSHOT = 2845
/** Цена урока этого абонемента — как у двух других взносов. */
const UNIT = 1_075
/** Сколько занятий на самом деле оплатил третий взнос. */
const LESSONS = 9

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

async function state(client: typeof prisma) {
  const wallet = await client.wallet.findUniqueOrThrow({
    where: { id: WALLET },
    select: { lessonsBalance: true },
  })
  const packages = await client.package.findMany({
    where: { walletId: WALLET },
    select: {
      id: true,
      status: true,
      lessonCount: true,
      remaining: true,
      price: true,
      unitPrice: true,
      productName: true,
    },
    orderBy: { id: 'asc' },
  })
  const entries = await client.walletEntry.findMany({
    where: { walletId: WALLET },
    select: { kind: true, quantity: true, packageId: true },
  })
  const debt = await client.attendance.count({
    where: { studentId: STUDENT, price: { not: null }, packageId: null },
  })
  return { wallet, packages, entries, debt }
}

async function report(client: typeof prisma, title: string) {
  const { wallet, packages, entries, debt } = await state(client)
  console.log(`\n── ${title} ──`)
  console.log(`  баланс кошелька: ${wallet.lessonsBalance}`)
  for (const p of packages) {
    console.log(
      `  пакет ${p.id} ${p.status.padEnd(9)} ${String(p.lessonCount).padStart(2)} зан. ` +
        `ост.${String(p.remaining).padStart(2)} ${rub(p.price).padStart(10)} @${rub(p.unitPrice)}  ` +
        `${p.productName || '—'}`,
    )
  }
  const total = entries.reduce((a, e) => a + e.quantity, 0)
  console.log(`  журнал: строк ${entries.length}, Σ quantity ${total}`)
  console.log(`  посещений «в долг» (цена есть, пакета нет): ${debt}`)

  // Те же инварианты, что сверяет check-ledger — но по одному кошельку и сразу.
  const perPackage = new Map<number, number>()
  for (const e of entries) {
    if (e.packageId === null) continue
    perPackage.set(e.packageId, (perPackage.get(e.packageId) ?? 0) + e.quantity)
  }
  const bad: string[] = []
  if (total !== wallet.lessonsBalance)
    bad.push(`Σ журнала ${total} ≠ баланс ${wallet.lessonsBalance}`)
  for (const p of packages) {
    const sum = perPackage.get(p.id) ?? 0
    if (sum !== p.remaining) bad.push(`пакет ${p.id}: Σ ${sum} ≠ остаток ${p.remaining}`)
  }
  console.log(bad.length === 0 ? '  инварианты сходятся ✓' : `  РАСХОЖДЕНИЯ: ${bad.join('; ')} ✗`)
  return bad
}

async function main() {
  await report(prisma, 'Сейчас')

  const debtRows = await prisma.attendance.findMany({
    where: { studentId: STUDENT, price: { not: null }, packageId: null },
    select: { id: true, lesson: { select: { date: true } } },
    orderBy: { lesson: { date: 'asc' } },
  })
  console.log(`\nПривязать к пакету ${INSTALMENT}: ${debtRows.length} занятий`)
  for (const r of debtRows) console.log(`  ${r.lesson.date}  посещение ${r.id}`)

  const instalment = await prisma.package.findUniqueOrThrow({
    where: { id: INSTALMENT },
    select: { price: true, lessonCount: true },
  })
  console.log(
    `\nПакет ${INSTALMENT}: ${instalment.lessonCount} зан. → ${LESSONS} зан., цена урока → ${rub(UNIT)}`,
  )
  console.log(
    `Пакет ${SNAPSHOT}: отменяется (разметка перехода описывала состояние, которого не было)`,
  )
  console.log(
    `\nНеразнесённым останется: ${rub(instalment.price - UNIT * LESSONS)} от взноса ` +
      `плюс 15 000 ₽ «Оплачено до перехода»`,
  )

  assert.equal(debtRows.length, LESSONS - 1, 'ожидалось восемь долговых занятий')

  if (!APPLY) {
    console.log('\n— прогон вхолостую. Записать: --apply')
    await prisma.$disconnect()
    return
  }

  const org = await prisma.wallet.findUniqueOrThrow({
    where: { id: WALLET },
    select: { organizationId: true, organization: { select: { timezone: true } } },
  })
  const today = todayYmdInTz(org.organization.timezone)
  const ids = debtRows.map((r) => r.id)

  await prisma.$transaction(async (tx) => {
    // 1. Долга не было: занятия оплачены третьим взносом.
    await tx.attendance.updateMany({ where: { id: { in: ids } }, data: { packageId: INSTALMENT } })
    await tx.walletEntry.updateMany({
      where: { attendanceId: { in: ids }, walletId: WALLET },
      data: { packageId: INSTALMENT, comment: null },
    })

    // 2. Взнос содержал девять занятий, а не одно.
    await tx.package.update({
      where: { id: INSTALMENT },
      data: { lessonCount: LESSONS, unitPrice: UNIT },
    })
    await tx.walletEntry.updateMany({
      where: { packageId: INSTALMENT, kind: 'PURCHASE' },
      data: { quantity: LESSONS, unitPrice: UNIT },
    })

    // 3. Сальдо закрывало долг, которого не было.
    await tx.walletEntry.updateMany({
      where: { walletId: WALLET, kind: 'ADJUSTMENT' },
      data: { quantity: 0, comment: 'Сальдо снято: долг закрыт третьим взносом абонемента' },
    })

    // 4. Снимок остатка отменяется штатно — встречной строкой, а не втихую.
    await tx.package.update({ where: { id: SNAPSHOT }, data: { unitPrice: UNIT } })
    await cancelPackageTx(tx, {
      packageId: SNAPSHOT,
      organizationId: org.organizationId,
      actorUserId: 1,
      effectiveAt: today,
    })
  })

  const bad = await report(prisma, 'После')
  assert.equal(bad.length, 0, 'инварианты кошелька разошлись')

  const { wallet } = await state(prisma)
  assert.equal(wallet.lessonsBalance, 0, 'на балансе не должно остаться занятий')

  console.log('\n— записано.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
