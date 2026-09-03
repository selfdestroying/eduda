/**
 * Разовая правка: сбить цену занятий, которым бэкфилл перехода выдал цену
 * сломанного пакета.
 *
 * ── Как ломается ─────────────────────────────────────────────────────────────
 *
 * Взнос рассрочки заводят в форме и правят количество занятий, а сумму оставляют
 * от продукта — так весь платёж ложится на одно занятие. У Максима Калинцева
 * годовой абонемент «ЭИ 36 занятий, разбивка на 3 платежа»: первые два взноса
 * заведены как 12 занятий по 1 075 ₽, третий (пакет 1939) — как **1 занятие за
 * 11 834 ₽**.
 *
 * Дальше ошибка размножается сама. Пакет исчерпан первым же занятием, и следующие
 * восемь списываются «в долг»: пакетов в кошельке больше нет.
 * `backfill-payment-packets.ts` ставит таким строкам последнюю известную цену
 * кошелька — а ею стала та самая 11 834 ₽. Одна цифра, введённая 15 апреля,
 * разошлась по девяти занятиям марта–мая: 109 731 ₽ признанной выручки вместо
 * 12 900 ₽, при том что за весь год ученик заплатил 52 634 ₽.
 *
 * ── Почему это можно править ─────────────────────────────────────────────────
 *
 * Журнал append-only, и строки в нём не редактируют. Но все девять строк написал
 * бэкфилл 30.08.2026 одним заходом: журнала до перехода не существовало вовсе, а
 * `effectiveAt` у них проставлен задним числом. Это та же разовая заливка истории,
 * которую правит `price-legacy-free-lessons.ts`, а не запись живой операции.
 *
 * Правятся парой — цена в посещении и `unitPrice` в его строке журнала. Порознь
 * нельзя: `check-ledger.ts` сверяет «выручку по журналу» с «выручкой по строкам»,
 * и правка одной стороны разведёт их.
 *
 * Баланс, остатки пакетов и статусы не двигаются: меняется только цена. Выручка
 * закрытых месяцев — двигается, в этом и смысл, и это решение школы, а не скрипта.
 *
 * ── Чего скрипт НЕ делает ────────────────────────────────────────────────────
 *
 * Не трогает причину. Пакет 1939 так и остаётся «1 занятие за 11 834 ₽», то есть
 * ученик недополучил 11 занятий абонемента, за который заплатил, а у пакета
 * остатка (2845) цена урока по-прежнему 11 834 ₽. Оба — отдельные решения.
 *
 *   pnpm --filter platform exec tsx scripts/fix-inflated-debt-lesson-prices.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/fix-inflated-debt-lesson-prices.ts --apply  # записать
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'

const APPLY = process.argv.includes('--apply')

/**
 * Кого правим. Список, а не поиск по правилу: цену занятия называет школа, и
 * каждая строка здесь — её решение, а не догадка скрипта.
 */
const TARGETS = [
  {
    studentId: 354,
    student: 'Максим Калинцев',
    from: 11_834,
    to: 1_075,
    /** Откуда `to`: 24 из 33 его оплаченных занятий прошли по этой цене. */
    why: 'третий взнос абонемента заведён как 1 занятие вместо 12 (пакет 1939)',
    expect: 9,
  },
]

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

async function main() {
  let totalBefore = 0
  let totalAfter = 0
  const ids: number[] = []

  for (const t of TARGETS) {
    const rows = await prisma.attendance.findMany({
      where: { studentId: t.studentId, price: t.from },
      select: {
        id: true,
        status: true,
        packageId: true,
        amount: true,
        lesson: { select: { date: true } },
      },
      orderBy: { lesson: { date: 'asc' } },
    })

    // Уже исправлено: цены `from` в базе не осталось. Не ошибка — повторный
    // запуск должен молчать, а не падать на проверке количества.
    if (rows.length === 0) {
      const done = await prisma.attendance.count({
        where: { studentId: t.studentId, price: t.to },
      })
      console.log(
        `\n${t.student} (id ${t.studentId}): уже исправлено (${done} зан. по ${rub(t.to)})`,
      )
      continue
    }

    console.log(`\n${t.student} (id ${t.studentId}) — ${t.why}`)
    console.log(`  ${rub(t.from)} → ${rub(t.to)} на ${rows.length} занятиях\n`)

    // Помесячно: именно эти цифры увидит школа в отчёте после правки.
    const months = new Map<string, { n: number; before: number; after: number }>()
    for (const r of rows) {
      const key = r.lesson.date.slice(0, 7)
      const cur = months.get(key) ?? { n: 0, before: 0, after: 0 }
      cur.n += 1
      cur.before += t.from * r.amount
      cur.after += t.to * r.amount
      months.set(key, cur)
      ids.push(r.id)
      console.log(
        `    ${r.lesson.date}  ${r.status.padEnd(8)} пакет ${String(r.packageId ?? '—').padStart(4)}  ` +
          `${rub(t.from)} → ${rub(t.to)}`,
      )
    }

    console.log('\n  По месяцам:')
    for (const [month, v] of [...months].sort()) {
      console.log(
        `    ${month}: ${v.n} зан., ${rub(v.before)} → ${rub(v.after)}  (−${rub(v.before - v.after)})`,
      )
      totalBefore += v.before
      totalAfter += v.after
    }

    // Список фиксированный: если выборка поймала не то, лучше не писать ничего.
    assert.equal(rows.length, t.expect, `ожидалось ${t.expect} занятий у ${t.student}`)
  }

  if (ids.length === 0) {
    console.log('\nПравить нечего.')
    await prisma.$disconnect()
    return
  }

  console.log(
    `\nВыручка закрытых месяцев: ${rub(totalBefore)} → ${rub(totalAfter)} ` +
      `(снимается ${rub(totalBefore - totalAfter)})`,
  )

  if (!APPLY) {
    console.log('\n— прогон вхолостую. Записать: --apply')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(async (tx) => {
    for (const t of TARGETS) {
      const attendances = await tx.attendance.updateMany({
        where: { studentId: t.studentId, price: t.from },
        data: { price: t.to },
      })
      // Строка журнала обязана говорить то же, что проводка на посещении.
      const ledger = await tx.walletEntry.updateMany({
        where: { attendanceId: { in: ids }, unitPrice: t.from },
        data: { unitPrice: t.to },
      })
      console.log(`\n  ${t.student}: посещений ${attendances.count}, строк журнала ${ledger.count}`)
      assert.equal(attendances.count, t.expect, 'обновилось не столько посещений, сколько нашли')
      assert.equal(ledger.count, t.expect, 'строк журнала обновилось не столько же')
    }
  })

  console.log('\n— записано.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
