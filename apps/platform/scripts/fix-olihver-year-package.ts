/**
 * Разовая правка: годовой абонемент Артёма Олихвера, разложенный миграцией не по
 * тем кошелькам.
 *
 * ── Что случилось ────────────────────────────────────────────────────────────
 *
 * 15.06.2026 из amoCRM приехал счёт на 36 900 ₽ — «36 занятий годового
 * абонемента» на 26/27. Старый парсер зачислил его в **прошлогодний** кошелёк
 * «КГ» (668), а не в «Оплата года 26/27» (1234), заведённый 26.05 под депозит
 * 5 000 ₽. 22.06 менеджер это поправил: перенёс 31 урок и 36 900 ₽ из 668 в 1234
 * (пять уже лежали депозитом — вышло ровно 36) и обнулил остаток старого
 * кошелька. В старой модели после этого всё сходилось.
 *
 * 30.08.2026 переезд на пакеты восстанавливал состав кошельков задним числом — до
 * него пакетов не существовало вовсе, а у оплат докошелькового времени не
 * записано ни кошелька, ни группы. На этом ученике реконструкция промахнулась
 * трижды:
 *
 *   1. Правило «пакет едет следом за переносом» ищет в источнике пакет **ровно на
 *      перенесённое количество**. Перенесли 31, пакет на 36 — не совпало, годовой
 *      абонемент остался в 668.
 *   2. Три оплаты по 5 490 ₽ (07.12.2025, 10.01, 27.01.2026) старше самого
 *      кошелька 668 (заведён 08.03.2026). Правило выбрало «кошелёк, где больше
 *      непокрытых списаний» и отправило их в 1234.
 *   3. Деньги в 1234 после этого не сошлись со счётчиком: 41 900 − (3 × 5 490 +
 *      5 000) = 20 430 ₽. Денежный шаг перехода дописал пломбу «Оплачено до
 *      перехода» на эту сумму, датой первого занятия ученика — 28.10.2025. Уроки
 *      не сошлись так же: пломба «Остаток на начало учёта пакетов» на 19 уроков.
 *
 * Итог: в кошельке года лежат три чужие оплаты прошлого года и 20 430 ₽,
 * которых никто не платил, а 17 занятий 25/26 списаны с абонемента 26/27 — то
 * есть оценены по 1 097 ₽ вместо своих 1 372 ₽.
 *
 * ── Откуда известно, как было на самом деле ──────────────────────────────────
 *
 * Легаси-счётчики кошельков (`lessonsBalance`, `totalLessons`, `totalPayments`)
 * миграция не трогала, и `StudentLessonsBalanceHistory` — тоже. Реконструкция
 * сходится с ними до рубля и до урока, без единой подгонки:
 *
 *   668:  28 уроков / 38 430 ₽ = семь пакетов «4 занятия» по 5 490 ₽, баланс 0
 *   1234: 36 уроков / 41 900 ₽ = депозит 5 000 ₽ + год 36 900 ₽, баланс 35
 *
 * Седьмого пакета 25/26 в базе нет: оплата за октябрь 2025 в систему не попала
 * (первая запись — 07.12.2025, а занятия идут с 28.10). Его роль и играет пломба
 * «Оплачено до перехода» — ей возвращается настоящий размер (4 урока за 5 490 ₽,
 * 1 372 ₽ за урок, как у всех шести соседей) и правильный кошелёк.
 *
 * ── Три решения школы, принятые 08.09.2026 ───────────────────────────────────
 *
 *   • Год — это 36 занятий, депозит внутри. Значит депозит даёт 5 уроков по
 *     1 000 ₽, годовой — оставшийся 31 по 1 190 ₽. Ровно то, что сделал менеджер
 *     22.06, перенеся 31 урок; обе суммы и обе даты поступлений остаются на месте.
 *   • Занятие 26.05.2026 закрывается нулём: за 25/26 проведено 29 занятий, а
 *     оплачено 28. Прощение обязано быть записанным — строка без цены осталась бы
 *     ждать оплаты, и ближайшая списала бы её сама.
 *   • Закрытые месяцы переписываются: выручка янв–май 2026 растёт на 3 303 ₽,
 *     сентябрь падает на 372 ₽, поступления по ученику уменьшаются на 17 540 ₽
 *     (2 600 — исправление цены абонемента, 14 940 — фантомные деньги пломбы).
 *
 * ── Почему журнал переписывается, а не правится встречными строками ──────────
 *
 * Обычно `WalletEntry` append-only, и ошибка исправляется откатом. Здесь иначе, и
 * с ведома школы: все строки этого ученика, кроме трёх сентябрьских, написаны
 * бэкфиллом 30.08 — это не история, а реконструкция, и переписывается она же.
 * Каскад из полусотни встречных строк сам стал бы мутью, в которой не разобраться.
 * Настоящая история при этом цела: `StudentLessonsBalanceHistory` не трогается —
 * именно по ней всё и восстановлено.
 *
 *   pnpm --filter platform exec tsx scripts/fix-olihver-year-package.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/fix-olihver-year-package.ts --apply  # записать
 */
import './load-env'

import assert from 'node:assert/strict'
import { type Prisma, prisma } from '@repo/db'

const APPLY = process.argv.includes('--apply')

const ORGANIZATION_ID = 1
const STUDENT_ID = 457
/** «КГ» — год 25/26, группа 46. */
const WALLET_OLD = 668
/** «Оплата года 26/27» — группа 262. */
const WALLET_NEW = 1234
const GROUP_OLD = 46

/** Когда бэкфилл открыл журнал: этим временем датируются восстановленные строки. */
const BACKFILL_AT = new Date('2026-08-30T16:14:12.427Z')

/** Очередь кошелька 668 после правки: семь пакетов «4 занятия» по 5 490 ₽. */
const QUEUE_OLD = [
  { id: 3622, date: '2025-10-28', lessons: 4, price: 5_490 },
  { id: 611, date: '2025-12-07', lessons: 4, price: 5_490 },
  { id: 858, date: '2026-01-10', lessons: 4, price: 5_490 },
  { id: 980, date: '2026-01-27', lessons: 4, price: 5_490 },
  { id: 1185, date: '2026-02-28', lessons: 4, price: 5_490 },
  { id: 1582, date: '2026-03-27', lessons: 4, price: 5_490 },
  { id: 2044, date: '2026-04-23', lessons: 4, price: 5_490 },
]

/** Депозит 26/27: пять уроков из тридцати шести, головной пакет очереди. */
const DEPOSIT = { id: 2482, date: '2026-05-26', lessons: 5, price: 5_000 }
/** Остаток годового абонемента: 31 урок — ровно столько перенёс менеджер 22.06. */
const YEAR = { id: 2605, date: '2026-06-15', lessons: 31, price: 36_900 }
/** Очередь кошелька 1234. Вместе — 36 уроков за 41 900 ₽. */
const QUEUE_NEW = [DEPOSIT, YEAR]

/** Пломба уроков, которая держала разницу: после правки держать нечего. */
const DROP_PACKAGE = 3085

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`
/** Как считает ядро (`unitPriceOf`): остаток от деления школа не досчитывает. */
const unitOf = (p: { price: number; lessons: number }) => Math.floor(p.price / p.lessons)

type Tx = Prisma.TransactionClient

/** Занятия, за которые школе платят: присутствовал либо пропустил без предупреждения. */
const billable = (a: { status: string; isWarned: boolean | null; isTrial: boolean }) =>
  !a.isTrial && (a.status === 'PRESENT' || (a.status === 'ABSENT' && a.isWarned !== true))

async function show(tx: Tx, title: string) {
  console.log(`\n── ${title} ──`)
  for (const walletId of [WALLET_OLD, WALLET_NEW]) {
    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { id: walletId },
      select: { name: true, lessonsBalance: true, totalLessons: true, totalPayments: true },
    })
    const packages = await tx.package.findMany({
      where: { walletId, status: { not: 'CANCELLED' } },
      select: {
        id: true,
        date: true,
        lessonCount: true,
        remaining: true,
        price: true,
        unitPrice: true,
        productName: true,
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    })
    const entries = await tx.walletEntry.findMany({
      where: { walletId },
      select: { quantity: true, packageId: true },
    })
    const ledgerSum = entries.reduce((s, e) => s + e.quantity, 0)

    console.log(`\n  Кошелёк ${walletId} «${wallet.name}»`)
    for (const p of packages) {
      console.log(
        `    пакет ${String(p.id).padStart(4)}  ${p.date}  ${String(p.lessonCount).padStart(2)} ур.` +
          `  ${rub(p.price).padStart(9)}  @${String(p.unitPrice).padStart(4)}  ост ${String(p.remaining).padStart(2)}` +
          `  ${p.productName || '—'}`,
      )
    }
    const sumPrice = packages.reduce((s, p) => s + p.price, 0)
    const sumLessons = packages.reduce((s, p) => s + p.lessonCount, 0)
    const sumRemaining = packages.reduce((s, p) => s + p.remaining, 0)
    console.log(
      `    Σ уроков ${sumLessons} / счётчик ${wallet.totalLessons}` +
        `,  Σ денег ${rub(sumPrice)} / счётчик ${rub(wallet.totalPayments)}` +
        `,  Σ остатков ${sumRemaining} / баланс ${wallet.lessonsBalance},  Σ журнала ${ledgerSum}`,
    )

    const broken: string[] = []
    if (ledgerSum !== wallet.lessonsBalance) {
      broken.push(`журнал ${ledgerSum} ≠ баланс ${wallet.lessonsBalance}`)
    }
    if (sumRemaining !== wallet.lessonsBalance) {
      broken.push(`остатки ${sumRemaining} ≠ баланс ${wallet.lessonsBalance}`)
    }
    if (sumLessons !== wallet.totalLessons) {
      broken.push(`уроки ${sumLessons} ≠ счётчик ${wallet.totalLessons}`)
    }
    if (sumPrice !== wallet.totalPayments) {
      broken.push(`деньги ${rub(sumPrice)} ≠ счётчик ${rub(wallet.totalPayments)}`)
    }
    for (const p of packages) {
      const own = entries.filter((e) => e.packageId === p.id).reduce((s, e) => s + e.quantity, 0)
      if (own !== p.remaining) broken.push(`пакет ${p.id}: журнал ${own} ≠ остаток ${p.remaining}`)
    }
    console.log(broken.length === 0 ? '    ✓ сходится' : `    ✗ ${broken.join('; ')}`)
  }

  const revenue = await tx.attendance.findMany({
    where: { studentId: STUDENT_ID, price: { not: null }, isTrial: false },
    select: { price: true, amount: true, lesson: { select: { date: true } } },
  })
  const byMonth = new Map<string, number>()
  for (const r of revenue) {
    const m = r.lesson.date.slice(0, 7)
    byMonth.set(m, (byMonth.get(m) ?? 0) + (r.price ?? 0) * r.amount)
  }
  console.log('\n  Выручка по месяцам:')
  for (const [m, v] of [...byMonth].sort()) console.log(`    ${m}  ${rub(v)}`)
  console.log(`    итого ${rub([...byMonth.values()].reduce((s, v) => s + v, 0))}`)
}

async function fix(tx: Tx) {
  // ─── 1. Пакеты ───────────────────────────────────────────────────────
  // Пломбе «Оплачено до перехода» возвращается настоящий размер: это оплата за
  // октябрь 2025, не попавшая в систему. Дата и `createdAt` не двигаются — по ним
  // «Авансы» относят деньги к месяцу.
  await tx.package.update({
    where: { id: 3622 },
    data: {
      walletId: WALLET_OLD,
      lessonCount: 4,
      remaining: 0,
      price: 5_490,
      unitPrice: 1_372,
      productName: '4 занятия (оплата до перехода)',
    },
  })

  // Три оплаты 25/26 возвращаются в свой кошелёк и тратятся там целиком.
  for (const id of [611, 858, 980]) {
    await tx.package.update({ where: { id }, data: { walletId: WALLET_OLD, remaining: 0 } })
  }
  // Остальные три пакета 25/26 уже на месте — остаток проставляется на всякий случай.
  for (const id of [1185, 1582, 2044]) {
    await tx.package.update({ where: { id }, data: { walletId: WALLET_OLD, remaining: 0 } })
  }

  // Депозит: пять уроков из тридцати шести, одним из них закрыто 01.09.
  await tx.package.update({
    where: { id: 2482 },
    data: { walletId: WALLET_NEW, remaining: 4, productName: 'Депозит года 26/27' },
  })

  // Годовой абонемент переезжает в кошелёк года. 31 урок, а не 36: пять внесены
  // депозитом, и именно 31 перенёс менеджер 22.06. Цена — сумма счёта из amoCRM,
  // а не цена продукта из прайса, которую подставлял старый парсер.
  await tx.package.update({
    where: { id: 2605 },
    data: {
      walletId: WALLET_NEW,
      lessonCount: 31,
      remaining: 31,
      price: 36_900,
      unitPrice: unitOf({ price: 36_900, lessons: 31 }),
    },
  })
  await tx.payment.update({ where: { id: 2605 }, data: { price: 36_900 } })

  // ─── 2. Раздача занятий по очереди ───────────────────────────────────
  const attendances = await tx.attendance.findMany({
    where: { studentId: STUDENT_ID },
    select: {
      id: true,
      status: true,
      isWarned: true,
      isTrial: true,
      makeupForAttendanceId: true,
      lesson: { select: { date: true, groupId: true } },
    },
    orderBy: [{ lesson: { date: 'asc' } }, { id: 'asc' }],
  })
  assert.equal(
    attendances.filter((a) => a.makeupForAttendanceId !== null).length,
    0,
    'у ученика появились отработки — раздача ниже их не учитывает',
  )

  /** FIFO по дате пакета — та же раздача, что делает `chargeAttendanceTx` вживую. */
  const deal = (queue: typeof QUEUE_OLD, rows: typeof attendances) => {
    const plan = new Map<number, { packageId: number; price: number }>()
    const spare: number[] = []
    let qi = 0
    let used = 0
    for (const a of rows) {
      let slot = queue[qi]
      while (slot && used === slot.lessons) {
        qi++
        used = 0
        slot = queue[qi]
      }
      if (!slot) {
        spare.push(a.id)
        continue
      }
      plan.set(a.id, { packageId: slot.id, price: unitOf(slot) })
      used++
    }
    return { plan, spare }
  }

  const paid = attendances.filter(billable)
  const old = deal(
    QUEUE_OLD,
    paid.filter((a) => a.lesson.groupId === GROUP_OLD),
  )
  const fresh = deal(
    QUEUE_NEW,
    paid.filter((a) => a.lesson.groupId !== GROUP_OLD),
  )
  assert.equal(fresh.spare.length, 0, 'занятий 26/27 больше, чем уроков в году')
  assert.equal(old.spare.length, 1, `непокрытых занятий 25/26: ${old.spare.length}, ожидалась одна`)

  for (const [id, { packageId, price }] of [...old.plan, ...fresh.plan]) {
    await tx.attendance.update({ where: { id }, data: { packageId, price, amount: 1 } })
  }
  // Занятие, до которого оплата не дотянулась: цена ноль, пакета нет. Ноль здесь —
  // не утверждение о стоимости, а запись о прощении: строка перестаёт ждать
  // оплату, которой не будет (год закрыт, группа завершена).
  for (const id of old.spare) {
    await tx.attendance.update({ where: { id }, data: { packageId: null, price: 0, amount: 1 } })
  }

  // ─── 3. Журнал ───────────────────────────────────────────────────────
  // Старые строки читаются до удаления: у восстановленных сохраняются `createdAt`,
  // автор и комментарий — журнал должен говорить, когда движение записали, а не
  // когда его переписали.
  const previous = await tx.walletEntry.findMany({
    where: { studentId: STUDENT_ID },
    select: {
      kind: true,
      packageId: true,
      attendanceId: true,
      createdAt: true,
      actorUserId: true,
      comment: true,
      reversalOfId: true,
      effectiveAt: true,
    },
    orderBy: { id: 'asc' },
  })
  const purchaseWas = new Map(
    previous.filter((e) => e.kind === 'PURCHASE').map((e) => [e.packageId, e]),
  )
  const chargeWas = new Map(
    previous.filter((e) => e.kind === 'CHARGE').map((e) => [e.attendanceId, e]),
  )
  const reversalWas = previous.filter((e) => e.kind === 'REVERSAL')

  await tx.walletEntry.deleteMany({ where: { studentId: STUDENT_ID } })
  // Пломба уроков держала разницу между догадкой и счётчиком. Разницы больше нет.
  // `deleteMany`, а не `delete`: скрипт от этого становится повторяемым, и
  // прогон вхолостую годится как сверка — он воспроизводит ту же картину, а не
  // падает на «пакета уже нет».
  await tx.package.deleteMany({ where: { id: DROP_PACKAGE } })

  const base = { organizationId: ORGANIZATION_ID, studentId: STUDENT_ID }

  for (const [walletId, queue] of [
    [WALLET_OLD, QUEUE_OLD],
    [WALLET_NEW, QUEUE_NEW],
  ] as const) {
    for (const p of queue) {
      const was = purchaseWas.get(p.id)
      await tx.walletEntry.create({
        data: {
          ...base,
          kind: 'PURCHASE',
          walletId,
          packageId: p.id,
          quantity: p.lessons,
          unitPrice: unitOf(p),
          effectiveAt: p.date,
          createdAt: was?.createdAt ?? BACKFILL_AT,
          actorUserId: was?.actorUserId ?? null,
        },
      })
    }
  }

  const dateOf = new Map(attendances.map((a) => [a.id, a.lesson.date]))
  for (const [walletId, dealt] of [
    [WALLET_OLD, old],
    [WALLET_NEW, fresh],
  ] as const) {
    for (const [attendanceId, { packageId, price }] of dealt.plan) {
      const was = chargeWas.get(attendanceId)
      await tx.walletEntry.create({
        data: {
          ...base,
          kind: 'CHARGE',
          walletId,
          packageId,
          attendanceId,
          quantity: -1,
          unitPrice: price,
          effectiveAt: dateOf.get(attendanceId)!,
          createdAt: was?.createdAt ?? BACKFILL_AT,
          actorUserId: was?.actorUserId ?? null,
        },
      })
    }
  }

  // Пара по удалённой строке посещаемости (урок 10758 снесли правкой расписания
  // 01.09, списание задвоилось уроком 10966). Строки уже нет, но след движения
  // денег её переживает: пара нулевая по сумме и переезжает на новый пакет вместе
  // со всем кошельком.
  for (const rev of reversalWas) {
    const charged = previous.find(
      (e) =>
        e.kind === 'CHARGE' && e.attendanceId === rev.attendanceId && e.createdAt < rev.createdAt,
    )
    assert.ok(charged, `откат ${rev.attendanceId} без своего списания`)
    const created = await tx.walletEntry.create({
      data: {
        ...base,
        kind: 'CHARGE',
        walletId: WALLET_NEW,
        packageId: DEPOSIT.id,
        attendanceId: rev.attendanceId,
        quantity: -1,
        unitPrice: unitOf(DEPOSIT),
        effectiveAt: charged.effectiveAt,
        createdAt: charged.createdAt,
        actorUserId: charged.actorUserId,
      },
    })
    await tx.walletEntry.create({
      data: {
        ...base,
        kind: 'REVERSAL',
        walletId: WALLET_NEW,
        packageId: DEPOSIT.id,
        attendanceId: rev.attendanceId,
        quantity: 1,
        unitPrice: unitOf(DEPOSIT),
        effectiveAt: rev.effectiveAt,
        createdAt: rev.createdAt,
        actorUserId: rev.actorUserId,
        comment: rev.comment,
        reversalOfId: created.id,
      },
    })
  }
}

/** Те же инварианты, что у `check-ledger` и `check-wallet-balance`, но по адресу. */
async function verify(tx: Tx) {
  for (const walletId of [WALLET_OLD, WALLET_NEW]) {
    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { id: walletId },
      select: { lessonsBalance: true, totalLessons: true, totalPayments: true },
    })
    const packages = await tx.package.findMany({
      where: { walletId, status: { not: 'CANCELLED' } },
      select: { id: true, lessonCount: true, remaining: true, price: true },
    })
    const entries = await tx.walletEntry.findMany({
      where: { walletId },
      select: { quantity: true, packageId: true },
    })

    assert.equal(
      entries.reduce((s, e) => s + e.quantity, 0),
      wallet.lessonsBalance,
      `кошелёк ${walletId}: Σ журнала ≠ баланс`,
    )
    assert.equal(
      packages.reduce((s, p) => s + p.remaining, 0),
      wallet.lessonsBalance,
      `кошелёк ${walletId}: Σ остатков ≠ баланс`,
    )
    assert.equal(
      packages.reduce((s, p) => s + p.lessonCount, 0),
      wallet.totalLessons,
      `кошелёк ${walletId}: Σ уроков ≠ счётчик`,
    )
    assert.equal(
      packages.reduce((s, p) => s + p.price, 0),
      wallet.totalPayments,
      `кошелёк ${walletId}: Σ денег ≠ счётчик`,
    )
    for (const p of packages) {
      assert.equal(
        entries.filter((e) => e.packageId === p.id).reduce((s, e) => s + e.quantity, 0),
        p.remaining,
        `пакет ${p.id}: Σ журнала ≠ остаток`,
      )
    }
  }

  // Выручка по журналу обязана совпасть с выручкой по строкам — это и сверяет
  // `check-ledger` по всей базе.
  const entries = await tx.walletEntry.findMany({
    where: { studentId: STUDENT_ID, attendanceId: { not: null } },
    select: { quantity: true, unitPrice: true, attendanceId: true },
  })
  const ledgerMoney = entries.reduce((s, e) => s - e.quantity * e.unitPrice, 0)
  const rows = await tx.attendance.findMany({
    where: {
      studentId: STUDENT_ID,
      price: { not: null },
      id: { in: [...new Set(entries.map((e) => e.attendanceId!))] },
    },
    select: { price: true, amount: true },
  })
  assert.equal(
    ledgerMoney,
    rows.reduce((s, r) => s + (r.price ?? 0) * r.amount, 0),
    'выручка по журналу ≠ выручка по строкам',
  )

  const dangling = await tx.walletEntry.count({
    where: { studentId: STUDENT_ID, kind: 'REVERSAL', reversalOfId: null },
  })
  assert.equal(dangling, 0, 'откат без своей пары')
}

const ROLLBACK = 'rollback: прогон вхолостую'

async function main() {
  try {
    await prisma.$transaction(
      async (tx) => {
        await show(tx, 'ДО')
        await fix(tx)
        await verify(tx)
        await show(tx, 'ПОСЛЕ')
        if (!APPLY) throw new Error(ROLLBACK)
      },
      { timeout: 60_000 },
    )
    console.log('\nЗаписано.')
  } catch (error) {
    if (!(error instanceof Error) || error.message !== ROLLBACK) throw error
    console.log('\nПрогон вхолостую, ничего не записано. Запись — с флагом --apply.')
  }
}

main().finally(() => prisma.$disconnect())
