/**
 * Разнесение по месяцам года для «Прибыли». Чистые функции без базы и без сессии —
 * проверяются `scripts/check-profit-rent.ts`.
 *
 * Все даты здесь — date-only строки `YYYY-MM-DD`. Через `new Date(ymd)` их разбирать
 * нельзя: строка парсится как полночь UTC, а `getMonth()` читает её в поясе процесса,
 * и на любом хосте западнее UTC первое число месяца уезжает в предыдущий.
 */

/** Месяц date-only строки как индекс 0–11. */
export const monthOf = (ymd: string) => Number(ymd.slice(5, 7)) - 1

/** Сквозной номер месяца (год × 12 + месяц) — для сравнения периодов аренды и ставок. */
export const monthIdxOf = (ymd: string) => Number(ymd.slice(0, 4)) * 12 + monthOf(ymd)

/** Полночь дня в UTC как ms — единый фрейм для пропорций разовой аренды. */
const msOf = (ymd: string) =>
  Date.UTC(Number(ymd.slice(0, 4)), monthOf(ymd), Number(ymd.slice(8, 10)))

export type RentRow = {
  amount: number
  isMonthly: boolean
  startDate: string
  endDate: string | null
  location: { name: string }
}

export interface RentAllocation {
  /** Сумма аренды за каждый месяц года. */
  perMonth: number[]
  /** Та же сумма в разрезе локаций, по месяцу на элемент. */
  byLocation: Map<string, number>[]
}

/**
 * Аренда по месяцам указанного года.
 *
 * - Ежемесячная идёт со своего месяца по месяц `endDate` включительно. Смену ставки
 *   выводить из порядка `startDate` незачем: `createRent` уже закрывает прежнюю
 *   аренду локации днём раньше новой, и в базе лежит готовая граница. Без неё
 *   закрытая аренда без преемника (преемника удалили) платилась бы до декабря.
 * - Разовая делится между месяцами пропорционально пересечению по дням, поэтому
 *   сумма долей за весь срок равна `amount` независимо от границ года.
 */
export function allocateRentByMonth(rents: RentRow[], year: number): RentAllocation {
  const perMonth = new Array<number>(12).fill(0)
  const byLocation: Map<string, number>[] = Array.from({ length: 12 }, () => new Map())

  // Границы месяцев в том же UTC-фрейме, что и `msOf`. Конец эксклюзивный — полночь
  // 1-го числа следующего месяца, поэтому соседние месяцы стыкуются без зазора.
  const monthStartMs = Array.from({ length: 12 }, (_, i) => Date.UTC(year, i, 1))
  const monthEndMs = Array.from({ length: 12 }, (_, i) => Date.UTC(year, i + 1, 1))

  const add = (m: number, locationName: string, amount: number) => {
    perMonth[m]! += amount
    const bucket = byLocation[m]!
    bucket.set(locationName, (bucket.get(locationName) ?? 0) + amount)
  }

  for (const r of rents) {
    const locationName = r.location.name

    if (r.isMonthly) {
      const startIdx = monthIdxOf(r.startDate)
      const endIdx = r.endDate ? monthIdxOf(r.endDate) : Number.POSITIVE_INFINITY
      for (let m = 0; m < 12; m++) {
        const monthIdx = year * 12 + m
        if (monthIdx < startIdx || monthIdx > endIdx) continue
        add(m, locationName, r.amount)
      }
      continue
    }

    if (!r.endDate) continue // safety: разовая аренда всегда должна иметь endDate
    const rStartMs = msOf(r.startDate)
    const rEndMs = msOf(r.endDate)
    const totalRentMs = rEndMs - rStartMs
    if (totalRentMs <= 0) {
      // Один день или испорченный диапазон: относим к месяцу начала, если он в году.
      if (Number(r.startDate.slice(0, 4)) === year)
        add(monthOf(r.startDate), locationName, r.amount)
      continue
    }
    for (let m = 0; m < 12; m++) {
      const overlapStart = Math.max(rStartMs, monthStartMs[m]!)
      const overlapEnd = Math.min(rEndMs, monthEndMs[m]!)
      if (overlapEnd <= overlapStart) continue
      add(m, locationName, r.amount * ((overlapEnd - overlapStart) / totalRentMs))
    }
  }

  return { perMonth, byLocation }
}
