/**
 * Разовая правка: сбить задранную цену урока у пакетов «Остаток на начало учёта
 * пакетов».
 *
 * `price-legacy-free-lessons.ts` выдавал цену занятиям, доставшимся по нулю, беря
 * медиану по соседям — группа, курс, школа. Каскад честный, но у горстки кошельков
 * соседом оказался взнос, заведённый как одно занятие: рассрочка за год, у которой
 * первые платежи стоят «12 занятий по 1075», а последний — «1 занятие за 11 834».
 * Эта цена и уехала в пакет остатка.
 *
 * Денег за такими пакетами нет вовсе (`price = 0`): они лежат в парном пакете
 * «Оплачено до перехода», который завёл `backfill-legacy-package-money.ts`. Значит
 * `unitPrice` здесь — единственное, что решает, сколько выручки признают эти уроки,
 * когда ученик их отходит. При цене 11 834 девять уроков признают 106 506 ₽,
 * которым не соответствует ни рубля.
 *
 * ── Как выбирается новая цена ────────────────────────────────────────────────
 *
 * Одной оценки мало: любая ошибается молча, а цена застывает в проводках навсегда.
 * Поэтому спрашиваем два независимых источника и правим только там, где они сошлись:
 *
 *   A. деньги парного «Оплачено до перехода» ÷ уроки этого пакета — арифметика:
 *      столько получено за столько занятий;
 *   B. медиана занятий, уже списанных с этого ученика — наблюдение: столько он
 *      платит на самом деле. Медиана, а не среднее: один задранный взнос её не тянет.
 *
 * Сошлись в пределах 5% — ставим B: это цена, которая в базе действительно
 * встречалась, а не остаток от деления. Разошлись — не трогаем и печатаем отдельно:
 * такие случаи разбирает школа, у неё есть то, чего нет в базе.
 *
 * Проверка эта не формальная — она же отбивает ложные срабатывания. У одного
 * ученика A даёт ровно текущую цену (значит она верна, а низкая медиана приехала
 * с другого курса), у другого дорогой урок — это интенсив, который столько и стоит.
 *
 * Берутся только нетронутые пакеты (`remaining = lessonCount`). У тронутого цена
 * уже застыла в проводках посещений, и правка развела бы её со списаниями — это
 * другая задача, с переписыванием прошлого.
 *
 * Правится и строка журнала о приходе уроков: иначе журнал утверждает, что уроки
 * пришли по одной цене, а пакет — что по другой. Выручку это не двигает (её считают
 * строки со ссылкой на посещение), так что append-only здесь не нарушается по
 * существу: строку писал бэкфилл, и ни в один отчёт она не попадала.
 *
 *   pnpm --filter platform exec tsx scripts/fix-inflated-legacy-unit-price.ts          # сводка
 *   pnpm --filter platform exec tsx scripts/fix-inflated-legacy-unit-price.ts --apply  # записать
 */
import './load-env'

import { prisma } from '@repo/db'

const APPLY = process.argv.includes('--apply')

/** Снимок остатка и его денежная пара — оба завёл бэкфилл перехода. */
const LEGACY_LESSONS = 'Остаток на начало учёта пакетов'
const LEGACY_MONEY = 'Оплачено до перехода'

/** Насколько кандидаты могут разойтись, чтобы считаться согласными. */
const AGREEMENT = 0.05
/**
 * Во сколько раз цена должна превышать оценку, чтобы считаться искажением.
 *
 * Полтора. Каскад `price-legacy-free-lessons.ts` брал медиану по группе и курсу, и
 * промах на десять-тридцать процентов — его нормальная точность, а не поломка:
 * школа меняла прайс в середине года, у кого-то скидка. Переписывать это значит
 * менять одну оценку на другую. Искажение, ради которого скрипт написан, выглядит
 * иначе — цена больше настоящей в три-семь раз, потому что приехала со взноса,
 * легшего на одно занятие.
 */
const INFLATED = 1.5

const rub = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

type Row = {
  id: number
  student: string
  walletId: number
  lessons: number
  current: number
  byMoney: number | null
  byMedian: number | null
  sample: number
  touched: boolean
}

async function collect(): Promise<Row[]> {
  const packages = await prisma.package.findMany({
    where: { productName: LEGACY_LESSONS, status: 'ACTIVE', price: 0, lessonCount: { gt: 0 } },
    select: {
      id: true,
      walletId: true,
      studentId: true,
      lessonCount: true,
      remaining: true,
      unitPrice: true,
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { id: 'asc' },
  })

  const rows: Row[] = []
  for (const p of packages) {
    const money = await prisma.package.findFirst({
      where: { walletId: p.walletId, productName: LEGACY_MONEY },
      select: { price: true },
    })

    // Ноль не берём: это занятия, отданные бесплатно, цену они не характеризуют.
    const prices = (
      await prisma.attendance.findMany({
        where: { studentId: p.studentId, price: { gt: 0 } },
        select: { price: true },
      })
    )
      .map((a) => a.price!)
      .sort((a, b) => a - b)

    rows.push({
      id: p.id,
      student: `${p.student.firstName} ${p.student.lastName}`,
      walletId: p.walletId,
      lessons: p.lessonCount,
      current: p.unitPrice,
      byMoney: money && money.price > 0 ? Math.floor(money.price / p.lessonCount) : null,
      byMedian: prices[Math.floor(prices.length / 2)] ?? null,
      sample: prices.length,
      touched: p.remaining !== p.lessonCount,
    })
  }
  return rows
}

/**
 * Что делать с пакетом: править, показать школе или пройти мимо.
 *
 * Порядок проверок — от «есть ли вообще подозрение» к «уверены ли мы в ответе»:
 * пока цена не выбивается ни из одной оценки, разбираться не в чем.
 */
function verdict(r: Row): { fix: number } | { doubt: string } | null {
  const { byMoney, byMedian, current } = r

  // Подозрение — только когда цена выше ОБЕИХ оценок: любая из них, подтвердившая
  // нынешнюю цену, снимает вопрос. Иначе в список лезут кошельки, где денежная
  // оценка мала сама по себе (до перехода платили мимо системы), а медиана
  // занятий говорит, что цена как раз верная.
  const candidates = [byMoney, byMedian].filter((v): v is number => v !== null && v > 0)
  if (candidates.length === 0) return null
  if (current <= Math.max(...candidates) * INFLATED) return null

  if (byMoney === null || byMedian === null) return { doubt: 'нет второго источника' }
  if (Math.abs(byMoney - byMedian) / byMedian > AGREEMENT) {
    return { doubt: 'источники расходятся' }
  }
  if (r.touched) return { doubt: 'пакет уже тронут — цена застыла в проводках' }

  return { fix: byMedian }
}

async function main() {
  const rows = await collect()

  const fixes: Array<Row & { to: number }> = []
  const doubts: Array<Row & { why: string }> = []
  for (const r of rows) {
    const v = verdict(r)
    if (!v) continue
    if ('fix' in v) fixes.push({ ...r, to: v.fix })
    else doubts.push({ ...r, why: v.doubt })
  }

  console.log(`Пакетов «${LEGACY_LESSONS}»: ${rows.length}\n`)

  let before = 0
  let after = 0
  console.log(`── Правим (источники сошлись): ${fixes.length} ──`)
  for (const f of fixes) {
    before += f.current * f.lessons
    after += f.to * f.lessons
    console.log(
      `  ${f.id} ${f.student} (кош. ${f.walletId}): ${f.lessons} ур. ` +
        `${rub(f.current)} → ${rub(f.to)}   ` +
        `[деньги/уроки ${f.byMoney}, медиана ${f.byMedian} по ${f.sample} занятиям]`,
    )
    console.log(`     будущая выручка ${rub(f.current * f.lessons)} → ${rub(f.to * f.lessons)}`)
  }

  if (doubts.length > 0) {
    console.log(`\n── Не трогаем, решает школа: ${doubts.length} ──`)
    for (const d of doubts) {
      console.log(
        `  ${d.id} ${d.student} (кош. ${d.walletId}): ${d.lessons} ур. по ${rub(d.current)} — ${d.why}`,
      )
      console.log(
        `     деньги/уроки ${d.byMoney === null ? '—' : rub(d.byMoney)}, ` +
          `медиана ${d.byMedian === null ? '—' : rub(d.byMedian)} по ${d.sample} занятиям, ` +
          `на кону ${rub(d.current * d.lessons)}`,
      )
    }
  }

  console.log(
    `\nБудущая выручка исправленных уроков: ${rub(before)} → ${rub(after)}` +
      (before > after ? ` (снимается ${rub(before - after)} без денег за ними)` : ''),
  )

  if (!APPLY) {
    console.log('\n— прогон вхолостую. Записать: --apply')
    await prisma.$disconnect()
    return
  }

  if (fixes.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const f of fixes) {
        await tx.package.update({ where: { id: f.id }, data: { unitPrice: f.to } })
        await tx.walletEntry.updateMany({
          where: { packageId: f.id, kind: 'PURCHASE' },
          data: { unitPrice: f.to },
        })
      }
    })
  }

  console.log('\n— записано.')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
