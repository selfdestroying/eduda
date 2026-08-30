/**
 * Проверка разнесения аренды по месяцам для «Прибыли». Базы не требует: это
 * чистая функция, и проверяются ровно её ветки — ежемесячная с закрытой датой,
 * ежемесячная бессрочная, смена ставки и пропорция разовой.
 *
 * Главное здесь — регрессия, ради которой всё это писалось: ежемесячная аренда
 * с проставленным `endDate` обязана останавливаться, даже если преемника у неё
 * нет. Раньше конец выводился из порядка `startDate`, и закрытая аренда без
 * преемника платилась до декабря.
 *
 *   pnpm --filter platform exec tsx scripts/check-profit-rent.ts
 */
import assert from 'node:assert/strict'

import { allocateRentByMonth, type RentRow } from '../src/features/finances/profit/months'

const loc = (name: string) => ({ name })
const monthly = (
  startDate: string,
  endDate: string | null,
  amount: number,
  name = 'Центр',
): RentRow => ({ amount, isMonthly: true, startDate, endDate, location: loc(name) })
const once = (startDate: string, endDate: string, amount: number, name = 'Центр'): RentRow => ({
  amount,
  isMonthly: false,
  startDate,
  endDate,
  location: loc(name),
})

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0)
const near = (a: number, b: number, msg: string) =>
  assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} ≠ ${b}`)

// 1. Бессрочная ежемесячная — все двенадцать месяцев.
{
  const { perMonth } = allocateRentByMonth([monthly('2026-01-01', null, 100)], 2026)
  assert.deepEqual(perMonth, new Array(12).fill(100), 'бессрочная аренда должна идти весь год')
}

// 2. Ежемесячная с закрытой датой — по месяц `endDate` включительно и ни месяцем
//    дальше. Преемника нет: именно это раньше уезжало до декабря.
{
  const { perMonth } = allocateRentByMonth([monthly('2026-01-01', '2026-05-31', 100)], 2026)
  assert.deepEqual(
    perMonth,
    [100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0],
    'закрытая аренда без преемника обязана остановиться на своём endDate',
  )
}

// 3. Смена ставки: старую закрыли днём раньше новой — ни зазора, ни двойного счёта.
{
  const { perMonth } = allocateRentByMonth(
    [monthly('2026-01-01', '2026-05-31', 100), monthly('2026-06-01', null, 150)],
    2026,
  )
  assert.deepEqual(
    perMonth,
    [100, 100, 100, 100, 100, 150, 150, 150, 150, 150, 150, 150],
    'на стыке ставок не должно быть ни пустого месяца, ни двух аренд сразу',
  )
}

// 4. Аренда началась в середине года — до неё месяцы пустые.
{
  const { perMonth } = allocateRentByMonth([monthly('2026-09-01', null, 100)], 2026)
  assert.deepEqual(perMonth, [0, 0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100], 'старт в сентябре')
}

// 5. Аренда прошлого года, закрытая в прошлом году, в этот год не попадает.
{
  const { perMonth } = allocateRentByMonth([monthly('2025-01-01', '2025-12-31', 100)], 2026)
  assert.equal(sum(perMonth), 0, 'аренда прошлого года не должна попадать в этот')
}

// 6. Разовая внутри года: сумма долей равна сумме аренды, месяцы вне срока пустые.
{
  const { perMonth } = allocateRentByMonth([once('2026-01-15', '2026-02-15', 3100)], 2026)
  near(sum(perMonth), 3100, 'разовая аренда должна раздаться целиком')
  near(perMonth[0]!, 1700, 'январская доля — 17 дней из 31')
  near(perMonth[1]!, 1400, 'февральская доля — 14 дней из 31')
  assert.equal(sum(perMonth.slice(2)), 0, 'после февраля разовой аренды быть не должно')
}

// 7. Разовая через границу года — в год попадает только своя доля, и по обоим
//    годам аренда не теряется и не удваивается.
//    `endDate` в этой пропорции эксклюзивна: 2025-12-01 → 2026-01-31 это 61 день,
//    из них 30 приходится на 2026 год.
{
  const rent = once('2025-12-01', '2026-01-31', 6100)
  const in2025 = allocateRentByMonth([rent], 2025)
  const in2026 = allocateRentByMonth([rent], 2026)
  near(
    sum(in2025.perMonth) + sum(in2026.perMonth),
    6100,
    'аренда через границу года не должна ни теряться, ни удваиваться',
  )
  near(sum(in2026.perMonth), (6100 * 30) / 61, 'на 2026 год приходится 30 дней из 61')
  near(in2026.perMonth[0]!, (6100 * 30) / 61, 'вся доля 2026 года — январская')
}

// 8. Разовая на один день (endDate == startDate) — целиком в месяц начала.
{
  const { perMonth } = allocateRentByMonth([once('2026-03-10', '2026-03-10', 500)], 2026)
  assert.equal(perMonth[2], 500, 'однодневная аренда идёт в свой месяц целиком')
  assert.equal(sum(perMonth), 500, 'и больше никуда')
}

// 9. Разрез по локациям сходится с итогом по месяцу.
{
  const { perMonth, byLocation } = allocateRentByMonth(
    [monthly('2026-01-01', null, 100, 'Центр'), monthly('2026-01-01', null, 70, 'Север')],
    2026,
  )
  assert.equal(perMonth[0], 170, 'две локации складываются')
  assert.equal(byLocation[0]!.get('Центр'), 100)
  assert.equal(byLocation[0]!.get('Север'), 70)
  for (let m = 0; m < 12; m++) {
    near(sum([...byLocation[m]!.values()]), perMonth[m]!, `месяц ${m}: локации ≠ итог`)
  }
}

console.log('Аренда по месяцам: все 9 проверок прошли.')
