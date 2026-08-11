/**
 * Открывает журнал движений (`WalletEntry`) по данным, которые уже есть в базе.
 *
 * Журнал должен с первого дня сходиться с колонками, которые он объясняет:
 *   Σ quantity по кошельку = Wallet.lessonsBalance
 *   Σ quantity по пакету   = Payment.remaining
 *
 * Поэтому пишем строки в три захода: приход по каждой оплате, списание по
 * каждому проведённому занятию, а остаток разницы — одной корректировкой
 * «сальдо на момент запуска журнала». История правок до этого дня не
 * восстанавливается: её нигде нет. Журнал полон начиная с сегодняшнего дня.
 *
 *   pnpm --filter platform exec tsx scripts/backfill-wallet-ledger.ts          # прогон вхолостую
 *   pnpm --filter platform exec tsx scripts/backfill-wallet-ledger.ts --apply  # записать
 */
import './load-env'

import { prisma } from '@repo/db'
import type { WalletEntryKind } from '@repo/db/enums'

type NewEntry = {
  organizationId: number
  walletId: number
  studentId: number
  kind: WalletEntryKind
  quantity: number
  unitPrice: number
  effectiveAt: string
  paymentId: number | null
  attendanceId: number | null
  comment: string | null
}

const apply = process.argv.includes('--apply')
/** День открытия журнала: сальдо датируем им, а не задним числом. */
const TODAY = new Date().toISOString().slice(0, 10)

const unit = (price: number, lessonCount: number) =>
  lessonCount > 0 ? Math.floor(price / lessonCount) : 0

async function main() {
  const existing = await prisma.walletEntry.count()
  if (existing > 0) {
    throw new Error(
      `В журнале уже ${existing} строк. Скрипт открывает журнал с нуля и повторно не запускается.`,
    )
  }

  const wallets = await prisma.wallet.findMany({
    select: { id: true, organizationId: true, studentId: true, lessonsBalance: true },
  })
  const walletById = new Map(wallets.map((w) => [w.id, w]))

  const payments = await prisma.payment.findMany({
    where: { walletId: { not: null } },
    select: {
      id: true,
      walletId: true,
      studentId: true,
      organizationId: true,
      date: true,
      price: true,
      lessonCount: true,
      remaining: true,
      status: true,
    },
    orderBy: { id: 'asc' },
  })

  const entries: NewEntry[] = []

  // ─── 1. Приход: каждая оплата ставит свои уроки в очередь ────────────
  for (const p of payments) {
    const wallet = walletById.get(p.walletId!)
    if (!wallet) continue
    entries.push({
      organizationId: p.organizationId,
      walletId: p.walletId!,
      studentId: p.studentId,
      kind: 'PURCHASE',
      quantity: p.lessonCount,
      unitPrice: unit(p.price, p.lessonCount),
      effectiveAt: p.date,
      paymentId: p.id,
      attendanceId: null,
      comment: null,
    })
  }

  // ─── 2. Расход: каждое списанное занятие ─────────────────────────────
  const attendances = await prisma.attendance.findMany({
    where: { amount: { gt: 0 } },
    select: {
      id: true,
      organizationId: true,
      studentId: true,
      walletId: true,
      paymentId: true,
      price: true,
      amount: true,
      lesson: { select: { date: true, groupId: true } },
      makeupForAttendance: { select: { lesson: { select: { groupId: true } } } },
    },
    orderBy: { id: 'asc' },
  })

  const paymentWallet = new Map(payments.map((p) => [p.id, p.walletId!]))

  const groupWallets = await prisma.studentGroup.findMany({
    where: { walletId: { not: null } },
    select: { studentId: true, groupId: true, walletId: true },
  })
  const groupWalletOf = new Map(
    groupWallets.map((sg) => [`${sg.studentId}:${sg.groupId}`, sg.walletId!]),
  )

  let orphanVisits = 0
  for (const a of attendances) {
    // Тот же порядок, что и в живом коде: пакет → кошелёк разового визита →
    // кошелёк группы (для отработки — группы пропуска).
    const groupId = a.makeupForAttendance ? a.makeupForAttendance.lesson.groupId : a.lesson.groupId
    const walletId =
      (a.paymentId ? paymentWallet.get(a.paymentId) : null) ??
      a.walletId ??
      groupWalletOf.get(`${a.studentId}:${groupId}`) ??
      null

    if (!walletId || !walletById.has(walletId)) {
      orphanVisits += 1
      continue
    }

    entries.push({
      organizationId: a.organizationId,
      walletId,
      studentId: a.studentId,
      kind: 'CHARGE',
      quantity: -a.amount!,
      unitPrice: a.price ?? 0,
      effectiveAt: a.lesson.date,
      paymentId: a.paymentId,
      attendanceId: a.id,
      comment: a.paymentId ? null : 'В долг: оплаты под это занятие в базе нет',
    })
  }

  // ─── 3. Сальдо: разница, которую нечем объяснить построчно ───────────
  const packetSum = new Map<number, number>()
  const walletSum = new Map<number, number>()
  for (const e of entries) {
    if (e.paymentId) packetSum.set(e.paymentId, (packetSum.get(e.paymentId) ?? 0) + e.quantity)
    walletSum.set(e.walletId, (walletSum.get(e.walletId) ?? 0) + e.quantity)
  }

  let packetFixes = 0
  for (const p of payments) {
    if (!p.walletId || !walletById.has(p.walletId)) continue
    const target = p.remaining ?? 0
    const delta = target - (packetSum.get(p.id) ?? 0)
    if (delta === 0) continue

    packetFixes += 1
    entries.push({
      organizationId: p.organizationId,
      walletId: p.walletId,
      studentId: p.studentId,
      kind: p.status === 'CANCELLED' ? 'CANCELLATION' : 'ADJUSTMENT',
      quantity: delta,
      unitPrice: unit(p.price, p.lessonCount),
      effectiveAt: TODAY,
      paymentId: p.id,
      attendanceId: null,
      comment:
        p.status === 'CANCELLED'
          ? 'Отменённая оплата: остаток снят до открытия журнала'
          : 'Сальдо пакета на момент открытия журнала',
    })
    walletSum.set(p.walletId, (walletSum.get(p.walletId) ?? 0) + delta)
  }

  let walletFixes = 0
  for (const w of wallets) {
    const delta = w.lessonsBalance - (walletSum.get(w.id) ?? 0)
    if (delta === 0) continue

    walletFixes += 1
    entries.push({
      organizationId: w.organizationId,
      walletId: w.id,
      studentId: w.studentId,
      kind: 'ADJUSTMENT',
      quantity: delta,
      unitPrice: 0,
      effectiveAt: TODAY,
      paymentId: null,
      attendanceId: null,
      comment: 'Сальдо кошелька на момент открытия журнала',
    })
  }

  console.log(`Кошельков: ${wallets.length}`)
  console.log(`Приход по оплатам: ${payments.length} строк`)
  console.log(`Расход по занятиям: ${attendances.length - orphanVisits} строк`)
  console.log(`Занятий без кошелька (пропущено): ${orphanVisits}`)
  console.log(`Сальдо по пакетам: ${packetFixes}`)
  console.log(`Сальдо по кошелькам: ${walletFixes}`)
  console.log(`Всего строк журнала: ${entries.length}`)

  if (!apply) {
    console.log('\nПрогон вхолостую. Записать: --apply')
    await prisma.$disconnect()
    return
  }

  const CHUNK = 2_000
  for (let i = 0; i < entries.length; i += CHUNK) {
    await prisma.walletEntry.createMany({ data: entries.slice(i, i + CHUNK) })
  }
  console.log('\nЖурнал открыт.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
