import { MON_SHORT, MONTHS, DOW_FULL } from './constants'
import { addDays, startOfWeek } from './date-utils'
import type { WeekStart } from '../types'

interface PeriodArgs {
  curr: Date
  view: string
  weekStart: WeekStart
  /** Кол-во видимых событий — для подзаголовка года. */
  eventCount: number
}

const pluralEvents = (n: number) => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} урок`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} урока`
  return `${n} уроков`
}

/** Заголовок и подзаголовок периода для десктопной шапки. */
export function getDesktopPeriod({ curr, view, weekStart, eventCount }: PeriodArgs) {
  const y = curr.getFullYear()
  const m = curr.getMonth()

  if (view === 'day') {
    return {
      title: `${curr.getDate()} ${MON_SHORT[m]}`,
      sub: `${DOW_FULL[curr.getDay()]}, ${y}`,
    }
  }
  if (view === 'week') {
    const s = startOfWeek(curr, weekStart)
    const e = addDays(s, 6)
    const sm = s.getMonth()
    const em = e.getMonth()
    return {
      title: `${MONTHS[addDays(s, 3).getMonth()]} ${y}`,
      sub: `${s.getDate()} ${MON_SHORT[sm]} – ${e.getDate()} ${em !== sm ? MON_SHORT[em] : MON_SHORT[sm]}`,
    }
  }
  if (view === 'month') {
    return { title: MONTHS[m], sub: String(y) }
  }
  if (view === 'list') {
    return { title: `${MONTHS[m]} ${y}`, sub: pluralEvents(eventCount) }
  }
  return { title: String(y), sub: pluralEvents(eventCount) }
}

/** Заголовок и подзаголовок периода для мобильной шапки. */
export function getMobilePeriod({ curr, view, weekStart, eventCount }: PeriodArgs) {
  const y = curr.getFullYear()
  const m = curr.getMonth()

  if (view === 'day') {
    return {
      title: `${curr.getDate()} ${MON_SHORT[m]}`,
      sub: `${DOW_FULL[curr.getDay()]}, ${y}`,
    }
  }
  if (view === 'week') {
    const s = startOfWeek(curr, weekStart)
    const e = addDays(s, 6)
    const sm = s.getMonth()
    const em = e.getMonth()
    return {
      title: `${s.getDate()} ${MON_SHORT[sm]} – ${e.getDate()} ${em !== sm ? MON_SHORT[em] : MON_SHORT[sm]}`,
      sub: String(y),
    }
  }
  if (view === 'month') {
    return { title: MONTHS[m], sub: String(y) }
  }
  if (view === 'list') {
    return { title: `${MONTHS[m]} ${y}`, sub: pluralEvents(eventCount) }
  }
  return { title: String(y), sub: pluralEvents(eventCount) }
}
