/**
 * Бэкфилл очереди пакетов: проставляет `Attendance.paymentId/price/amount` и
 * `Payment.remaining` по всей истории.
 *
 * Цена восстанавливается НА ДАТУ визита, а не по сегодняшнему среднему кошелька:
 * платежи кошелька выстраиваются в очередь по дате, посещения — по дате урока, и
 * дальше повторяется та же FIFO-раздача, что делает `applyPacketEntryTx` вживую.
 * Залить историю текущим средним значило бы вписать в базу ровно тот перекос, из-за
 * которого всё затевалось.
 *
 * Раздача детерминирована: повторный прогон по тем же данным даёт тот же результат,
 * включая строки, проштампованные уже вживую. Единственное, что скрипт делает заново
 * при каждом прогоне, — снятие остатка у кошельков, где баланс ниже суммы пакетов:
 * шаг записи `remaining` восстанавливает пакеты по формуле «куплено минус списано» и
 * тем самым стирает прошлое снятие. Результат от этого не меняется, но в сводке такие
 * кошельки будут видны всегда.
 *
 * Три поправки на то, что история заводилась не в этой модели.
 *
 * 1. Оплаты до появления кошельков (в этой базе до 24.02.2026) хранят `walletId = null`,
 *    хотя счётчики кошелька заполнены ровно из них. Кошелёк восстанавливается по группе
 *    оплаты, иначе — единственный кошелёк ученика, иначе — тот из его кошельков, где
 *    больше непокрытых списаний. Последнее уже выбор, а не факт: сумма выручки сойдётся,
 *    а разрез по группам местами соврёт, поэтому такие строки печатаются списком
 *    (`--verbose`), чтобы школа могла поправить руками.
 *
 * 2. Часть уроков школа провела, не заведя под них оплату. Такой визит признаётся «в
 *    долг» по последней известной цене кошелька — цене пакета, из которого списывали
 *    последним, а если пакетов не было вовсе, то из счётчиков кошелька. Ссылки на пакет
 *    у него нет, но цена всё равно застывает в строке и задним числом не поедет.
 *
 * 3. Перенос баланса между кошельками ученика двигал только числа — пакеты оставались
 *    в источнике. Восстанавливаем по журналу `WALLET_TRANSFER`: если в источнике есть
 *    нетронутый пакет ровно на перенесённое количество, он переезжает следом. Это
 *    типовой случай «оплату завели не в тот кошелёк и сразу перекинули».
 *
 *   pnpm --filter platform exec tsx scripts/backfill-payment-packets.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/backfill-payment-packets.ts --apply  # запись
 */
import './load-env'

import { prisma } from '@repo/db'
import { isLessonCharged } from '../src/features/finances/packets.server'

const APPLY = process.argv.includes('--apply')
const VERBOSE = process.argv.includes('--verbose')
const CHUNK = 1000

type Packet = { id: number; price: number; lessonCount: number; consumed: number }
type Entry = { id: number; paymentId: number | null; price: number; amount: number }

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

async function main() {
  // Корректировки в раздаче истории не участвуют: они заведены под будущие списания и
  // под сведение остатка. Пусти их в очередь — прошлые визиты их съедят, остаток
  // снова разойдётся, и следующий прогон заведёт ещё одну порцию корректировок.
  const allPayments = (
    await prisma.payment.findMany({
      // Отменённая оплата в очередь не встаёт: её остаток обнулён, а деньги школе не
      // достались. Проводки, что успели с неё списаться, остаются как есть.
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        walletId: true,
        studentId: true,
        groupId: true,
        date: true,
        price: true,
        lessonCount: true,
        isAdjustment: true,
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    })
  ).filter((p) => !p.isAdjustment)

  const adjustmentRemaining = new Map<number, number>()
  for (const p of await prisma.payment.findMany({
    where: { isAdjustment: true, status: 'ACTIVE', walletId: { not: null } },
    select: { walletId: true, remaining: true },
  })) {
    adjustmentRemaining.set(
      p.walletId!,
      (adjustmentRemaining.get(p.walletId!) ?? 0) + (p.remaining ?? 0),
    )
  }

  // Перенос баланса между кошельками ученика двигал только числа, пакеты оставались
  // в кошельке-источнике. Восстанавливаем по журналу: нетронутый пакет ровно на
  // перенесённое количество — это «оплату завели не в тот кошелёк и сразу перекинули».
  // Частичные переносы не трогаем, гадать там не на чем.
  const transfers = await prisma.studentLessonsBalanceHistory.findMany({
    where: { reason: 'WALLET_TRANSFER', field: 'LESSONS_BALANCE', delta: { gt: 0 } },
    select: { walletId: true, delta: true, comment: true },
    orderBy: { createdAt: 'asc' },
  })

  const moved: { id: number; walletId: number }[] = []
  for (const t of transfers) {
    const sourceId = Number(/#(\d+)/.exec(t.comment ?? '')?.[1])
    if (!sourceId || !t.walletId) continue

    const packet = allPayments.find(
      (p) =>
        p.walletId === sourceId && p.lessonCount === t.delta && !moved.some((m) => m.id === p.id),
    )
    if (!packet) continue

    packet.walletId = t.walletId
    moved.push({ id: packet.id, walletId: t.walletId })
  }

  const studentGroups = await prisma.studentGroup.findMany({
    select: { studentId: true, groupId: true, walletId: true },
  })
  const groupWallet = new Map<string, number | null>(
    studentGroups.map((sg) => [`${sg.studentId}:${sg.groupId}`, sg.walletId]),
  )

  const wallets = await prisma.wallet.findMany({
    select: {
      id: true,
      studentId: true,
      organizationId: true,
      lessonsBalance: true,
      totalPayments: true,
      totalLessons: true,
    },
    orderBy: { id: 'asc' },
  })

  // Кошельки ученика в порядке появления: первый обычно и есть основной курс.
  const studentWallets = new Map<number, number[]>()
  for (const w of wallets) {
    studentWallets.set(w.studentId, [...(studentWallets.get(w.studentId) ?? []), w.id])
  }

  // Цена из счётчиков кошелька — всё, что осталось от доплатформенного учёта у
  // кошельков, которым при переезде проставили суммы, но не завели ни одной оплаты.
  const counterPrice = new Map<number, number>(
    wallets.map((w) => [
      w.id,
      w.totalLessons > 0 ? Math.floor(w.totalPayments / w.totalLessons) : 0,
    ]),
  )

  const attendances = await prisma.attendance.findMany({
    where: { isTrial: false },
    select: {
      id: true,
      studentId: true,
      walletId: true,
      status: true,
      isWarned: true,
      lesson: { select: { date: true, groupId: true } },
      makeupForAttendance: { select: { lesson: { select: { groupId: true } } } },
    },
    orderBy: [{ id: 'asc' }],
  })

  const walletOfVisit = (a: (typeof attendances)[number]) => {
    const groupId = a.makeupForAttendance?.lesson.groupId ?? a.lesson.groupId
    return a.walletId ?? groupWallet.get(`${a.studentId}:${groupId}`) ?? null
  }

  // Спрос кошелька — сколько уроков с него вообще списали за всю историю; покрытие —
  // сколько уроков ему принесли оплаты, у которых кошелёк известен точно.
  const demand = new Map<number, number>()
  for (const a of attendances) {
    if (!isLessonCharged(a.status, a.isWarned === true)) continue
    const walletId = walletOfVisit(a)
    if (walletId) demand.set(walletId, (demand.get(walletId) ?? 0) + 1)
  }
  const deficit = new Map<number, number>(demand)
  for (const p of allPayments) {
    if (p.walletId) deficit.set(p.walletId, (deficit.get(p.walletId) ?? 0) - p.lessonCount)
  }

  // Восстановление кошелька у доплатформенных оплат. Точная привязка — по группе
  // оплаты или когда кошелёк у ученика один. Иначе оплата уходит туда, где есть
  // непокрытый спрос: класть её в «старший» кошелёк вслепую значит одновременно
  // морить голодом второй курс и копить на первом остаток, которого нет.
  const adopted: { id: number; walletId: number }[] = []
  const guessed: { id: number; walletId: number; studentId: number; date: string }[] = []
  let orphans = 0

  const payments = allPayments.flatMap((p) => {
    if (p.walletId) return [{ ...p, walletId: p.walletId }]

    const own = studentWallets.get(p.studentId) ?? []
    const fromGroup = p.groupId ? (groupWallet.get(`${p.studentId}:${p.groupId}`) ?? null) : null
    const hungriest = [...own].sort((x, y) => (deficit.get(y) ?? 0) - (deficit.get(x) ?? 0))[0]
    const walletId = fromGroup ?? (own.length === 1 ? own[0] : (hungriest ?? null))

    if (!walletId) {
      orphans += 1
      return []
    }

    deficit.set(walletId, (deficit.get(walletId) ?? 0) - p.lessonCount)
    adopted.push({ id: p.id, walletId })
    if (!fromGroup && own.length > 1) {
      guessed.push({ id: p.id, walletId, studentId: p.studentId, date: p.date })
    }
    return [{ ...p, walletId }]
  })

  // Очередь пакетов на кошелёк — тот же порядок, что и в живом списании.
  const queues = new Map<number, Packet[]>()
  for (const p of payments) {
    const queue = queues.get(p.walletId) ?? []
    queue.push({ id: p.id, price: p.price, lessonCount: p.lessonCount, consumed: 0 })
    queues.set(p.walletId, queue)
  }

  // Посещения кошелька в хронологическом порядке: сначала дата урока, потом id —
  // два урока одного дня должны раздаваться стабильно, а не как ляжет.
  const visits = new Map<number, { id: number; date: string; charged: boolean }[]>()
  let unresolved = 0

  for (const a of attendances) {
    const walletId = walletOfVisit(a)
    if (!walletId) {
      unresolved += 1
      continue
    }
    const list = visits.get(walletId) ?? []
    list.push({
      id: a.id,
      date: a.lesson.date,
      charged: isLessonCharged(a.status, a.isWarned === true),
    })
    visits.set(walletId, list)
  }

  const entries: Entry[] = []
  let withPacket = 0
  let onCredit = 0
  let onCreditSum = 0
  let priceless = 0

  const unitPrice = (p: Packet) => (p.lessonCount > 0 ? Math.floor(p.price / p.lessonCount) : 0)

  for (const [walletId, list] of visits) {
    const queue = queues.get(walletId) ?? []
    list.sort((x, y) => (x.date === y.date ? x.id - y.id : x.date < y.date ? -1 : 1))

    // Цена кошелька на случай, когда пакеты кончились: сначала самая ранняя
    // известная, дальше — цена последнего пакета, из которого реально списывали.
    const head = queue[0]
    let lastPrice = head ? unitPrice(head) : (counterPrice.get(walletId) ?? 0)

    for (const visit of list) {
      if (!visit.charged) {
        entries.push({ id: visit.id, paymentId: null, price: 0, amount: 0 })
        continue
      }

      const packet = queue.find((p) => p.consumed < p.lessonCount)
      if (!packet) {
        // Урок школа провела, а оплаты под него в базе нет: часть истории заводили
        // не полностью. Признаём выручку по последней известной цене кошелька —
        // «в долг». Цена всё равно застывает в строке, задним числом не поедет.
        entries.push({ id: visit.id, paymentId: null, price: lastPrice, amount: 1 })
        onCredit += 1
        onCreditSum += lastPrice
        if (lastPrice === 0) priceless += 1
        continue
      }

      packet.consumed += 1
      withPacket += 1
      lastPrice = unitPrice(packet)
      entries.push({ id: visit.id, paymentId: packet.id, price: lastPrice, amount: 1 })
    }
  }

  const remainings = payments.map((p) => {
    const packet = queues.get(p.walletId)!.find((q) => q.id === p.id)!
    return { id: p.id, remaining: Math.max(0, p.lessonCount - packet.consumed) }
  })

  const revenue = entries.reduce((sum, e) => sum + e.price * e.amount, 0)
  const leftover = remainings.reduce((sum, r) => sum + r.remaining, 0)

  console.log('\nБэкфилл очереди пакетов' + (APPLY ? ' — ЗАПИСЬ' : ' — сводка, база не меняется'))
  console.log('─'.repeat(64))
  console.log(`Проводок будет проставлено      ${entries.length}`)
  console.log(`  из них с пакетом              ${withPacket}`)
  console.log(`  в долг, по цене кошелька      ${onCredit} на ${rub(onCreditSum)}`)
  console.log(`  из них без известной цены     ${priceless} (у кошелька не было ни одной оплаты)`)
  console.log(`Посещений без кошелька          ${unresolved} (пропущены, остаются неразмеченными)`)
  console.log(`Пакетов получат остаток         ${remainings.length}`)
  console.log('─'.repeat(64))
  console.log(`Пакетов переедут за переносом   ${moved.length} из ${transfers.length} переносов`)
  console.log(`Доплатформенных оплат привяжем  ${adopted.length}`)
  console.log(`  из них выбором кошелька       ${guessed.length} (у ученика их несколько)`)
  console.log(`  без единого кошелька          ${orphans} (пропущены)`)
  console.log('─'.repeat(64))
  console.log(`Признанная выручка за всю историю ${rub(revenue)}`)
  console.log(`Нерастраченный остаток            ${leftover} уроков`)

  // Расхождение с lessonsBalance — это накопленный дрейф мутируемого счётчика
  // (ручные правки баланса, переносы между кошельками). Не чиним, а показываем.
  const byWallet = new Map<number, number>(adjustmentRemaining)
  for (const p of payments) {
    const packet = queues.get(p.walletId)!.find((q) => q.id === p.id)!
    byWallet.set(p.walletId, (byWallet.get(p.walletId) ?? 0) + (p.lessonCount - packet.consumed))
  }
  const drifted = wallets.filter((w) => (byWallet.get(w.id) ?? 0) !== w.lessonsBalance)
  const driftSum = drifted.reduce(
    (sum, w) => sum + Math.abs((byWallet.get(w.id) ?? 0) - w.lessonsBalance),
    0,
  )
  console.log(`Кошельков с расхождением          ${drifted.length} из ${wallets.length}`)
  console.log(`Суммарное расхождение             ${driftSum} уроков`)

  // Остаток расхождения — след ручных операций: правки баланса, раздачи с общего
  // остатка ученика, частичные переносы. Платежа за ними нет, восстановить его
  // неоткуда, поэтому выравниваем одной корректировкой на кошелёк: плюс — пакет
  // `isAdjustment` по последней известной цене, минус — снятие остатка с хвоста.
  const adjustments = drifted.map((w) => {
    const queue = queues.get(w.id) ?? []
    const last = queue.at(-1)
    return {
      walletId: w.id,
      studentId: w.studentId,
      lessons: w.lessonsBalance - (byWallet.get(w.id) ?? 0),
      unitPrice: last
        ? Math.floor(last.price / Math.max(1, last.lessonCount))
        : (counterPrice.get(w.id) ?? 0),
    }
  })
  const added = adjustments.filter((a) => a.lessons > 0)
  const removed = adjustments.filter((a) => a.lessons < 0)
  console.log(
    `  из них добавим уроков           ${added.reduce((s, a) => s + a.lessons, 0)} (${added.length} кошельков)`,
  )
  console.log(
    `  из них снимем уроков            ${-removed.reduce((s, a) => s + a.lessons, 0)} (${removed.length} кошельков)`,
  )

  const byAttendance = new Map(entries.map((e) => [e.id, e]))
  const monthly = new Map<string, number>()
  for (const a of attendances) {
    const entry = byAttendance.get(a.id)
    if (!entry || entry.amount === 0) continue
    const month = a.lesson.date.slice(0, 7)
    monthly.set(month, (monthly.get(month) ?? 0) + entry.price * entry.amount)
  }
  const months = [...monthly.entries()].sort().slice(-12)
  if (months.length) {
    console.log('─'.repeat(64))
    console.log('Выручка по месяцам (последние 12):')
    for (const [month, sum] of months) console.log(`  ${month}   ${rub(sum)}`)
  }

  if (guessed.length) {
    console.log('─'.repeat(64))
    console.log(
      `Кошелёк выбран догадкой у ${guessed.length} оплат${VERBOSE ? ':' : ' (--verbose — список)'}`,
    )
    for (const g of VERBOSE ? guessed : guessed.slice(0, 5)) {
      console.log(`  оплата ${g.id}  ученик ${g.studentId}  ${g.date}  → кошелёк ${g.walletId}`)
    }
    if (!VERBOSE && guessed.length > 5) console.log(`  … и ещё ${guessed.length - 5}`)
  }

  if (!APPLY) {
    console.log('\nЧтобы записать: тот же скрипт с флагом --apply\n')
    await prisma.$disconnect()
    return
  }

  for (let i = 0; i < moved.length; i += CHUNK) {
    const chunk = moved.slice(i, i + CHUNK)
    await prisma.$executeRaw`
      UPDATE "Payment" p
      SET "walletId" = v.wallet_id
      FROM unnest(${chunk.map((m) => m.id)}::int[], ${chunk.map((m) => m.walletId)}::int[])
        AS v(id, wallet_id)
      WHERE p.id = v.id`
  }

  for (let i = 0; i < adopted.length; i += CHUNK) {
    const chunk = adopted.slice(i, i + CHUNK)
    await prisma.$executeRaw`
      UPDATE "Payment" p
      SET "walletId" = v.wallet_id
      FROM unnest(${chunk.map((a) => a.id)}::int[], ${chunk.map((a) => a.walletId)}::int[])
        AS v(id, wallet_id)
      WHERE p.id = v.id AND p."walletId" IS NULL`
  }

  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK)
    await prisma.$executeRaw`
      UPDATE "Attendance" a
      SET "paymentId" = v.payment_id, "price" = v.price, "amount" = v.amount
      FROM unnest(
        ${chunk.map((e) => e.id)}::int[],
        ${chunk.map((e) => e.paymentId)}::int[],
        ${chunk.map((e) => e.price)}::int[],
        ${chunk.map((e) => e.amount)}::int[]
      ) AS v(id, payment_id, price, amount)
      WHERE a.id = v.id`
  }

  for (let i = 0; i < remainings.length; i += CHUNK) {
    const chunk = remainings.slice(i, i + CHUNK)
    await prisma.$executeRaw`
      UPDATE "Payment" p
      SET "remaining" = v.remaining
      FROM unnest(${chunk.map((r) => r.id)}::int[], ${chunk.map((r) => r.remaining)}::int[])
        AS v(id, remaining)
      WHERE p.id = v.id`
  }

  const orgByWallet = new Map(wallets.map((w) => [w.id, w.organizationId]))
  const today = new Date().toISOString().slice(0, 10)

  if (added.length > 0) {
    await prisma.payment.createMany({
      data: added.map((a) => ({
        organizationId: orgByWallet.get(a.walletId)!,
        studentId: a.studentId,
        walletId: a.walletId,
        date: today,
        lessonCount: a.lessons,
        price: a.unitPrice * a.lessons,
        bidForLesson: a.unitPrice,
        remaining: a.lessons,
        isAdjustment: true,
        productName: 'Остаток на начало учёта пакетов',
      })),
    })
  }

  for (const a of removed) {
    let left = -a.lessons
    const tail = await prisma.payment.findMany({
      where: { walletId: a.walletId, remaining: { gt: 0 } },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      select: { id: true, remaining: true },
    })
    for (const p of tail) {
      if (left === 0) break
      const take = Math.min(p.remaining ?? 0, left)
      await prisma.payment.update({ where: { id: p.id }, data: { remaining: { decrement: take } } })
      left -= take
    }
  }

  console.log('\nЗаписано.\n')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
