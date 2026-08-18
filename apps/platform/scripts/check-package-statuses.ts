/**
 * Согласованность статусов счёта и его пакетов.
 *
 * Сверки журнала (`check-ledger.ts`) этого не видят: при любом перекосе статусов
 * `Σ quantity` продолжает сходиться с `remaining` и `lessonsBalance` — журнал
 * честно записывает то, что ему велели. Перекос виден только между двумя
 * таблицами, и ищется он здесь.
 *
 *   1. у счёта PENDING нет пакетов ACTIVE — уроки выданы за неоплаченное;
 *   2. у счёта ACTIVE нет пакетов PENDING — деньги взяли, уроки не выдали;
 *   3. у пакета PENDING остаток равен размеру и ни одной строки журнала;
 *   4. у отменённого пакета остаток нулевой — иначе он стоит в очереди списания.
 *
 * Первое сторожит `activatePackageTx`; здесь проверяются данные, накопленные до
 * него и мимо него. Второе не сторожит никто: подтверждение счёта выдаёт пакеты
 * циклом, и упавший на середине вызов оставит хвост неразобранным.
 *
 *   pnpm --filter platform exec tsx scripts/check-package-statuses.ts
 */
import './load-env'

import { prisma } from '@repo/db'

const fmt = (n: number) => n.toLocaleString('ru-RU')

/** Печатает итог проверки и возвращает, всё ли хорошо. */
function report(title: string, ids: number[], hint: string): boolean {
  if (ids.length === 0) {
    console.log(`  ✓ ${title}`)
    return true
  }
  console.log(`  ✗ ${title}: ${fmt(ids.length)}`)
  console.log(`    ${hint}`)
  console.log(`    id: ${ids.slice(0, 10).join(', ')}${ids.length > 10 ? ' …' : ''}`)
  return false
}

async function main() {
  const total = await prisma.package.count()
  console.log(`Пакетов в базе: ${fmt(total)}\n`)

  // ─── 1. Уроки выданы по неоплаченному счёту ──────────────────────────
  const activeOnPending = await prisma.package.findMany({
    where: { status: 'ACTIVE', payment: { status: 'PENDING' } },
    select: { id: true },
  })

  // ─── 2. Счёт оплачен, а пакет так и не выдан ─────────────────────────
  // Отменённые пакеты сюда не идут: их не выдают намеренно.
  const pendingOnActive = await prisma.package.findMany({
    where: { status: 'PENDING', payment: { status: 'ACTIVE' } },
    select: { id: true },
  })

  // ─── 3. Черновик не должен двигать ни остаток, ни журнал ─────────────
  const drafts = await prisma.package.findMany({
    where: { status: 'PENDING' },
    select: { id: true, lessonCount: true, remaining: true, _count: { select: { ledger: true } } },
  })
  const touchedDrafts = drafts
    .filter((p) => p.remaining !== p.lessonCount || p._count.ledger > 0)
    .map((p) => p.id)

  // ─── 4. Отменённый пакет не стоит в очереди ──────────────────────────
  // Очередь берёт `status: 'ACTIVE'`, так что ненулевой остаток отменённого
  // пакета сам по себе никого не спишет. Но он врёт в отчётах об остатках и
  // означает, что отмена не досчитала — снятие остатка входит в неё.
  const cancelledWithRemainder = await prisma.package.findMany({
    where: { status: 'CANCELLED', remaining: { not: 0 } },
    select: { id: true },
  })

  const ok = [
    report(
      'у неоплаченного счёта нет выданных пакетов',
      activeOnPending.map((p) => p.id),
      'уроки зачислены и по ним признаётся выручка, хотя денег за них нет',
    ),
    report(
      'у оплаченного счёта нет забытых пакетов',
      pendingOnActive.map((p) => p.id),
      'деньги получены, уроки на баланс не легли — ученик не может ходить',
    ),
    report(
      'черновик не двигает остаток и журнал',
      touchedDrafts,
      'у пакета PENDING остаток обязан равняться размеру, а строк журнала быть не должно',
    ),
    report(
      'у отменённого пакета остаток нулевой',
      cancelledWithRemainder.map((p) => p.id),
      'отмена обязана снять непотраченное — иначе остаток виден в отчётах как живой',
    ),
  ].every(Boolean)

  console.log(ok ? '\nСтатусы сходятся.' : '\nСтатусы разошлись.')
  await prisma.$disconnect()
  if (!ok) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
