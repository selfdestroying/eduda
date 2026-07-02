import type { CalendarEvent, DayStatus, WeekStart } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')

/** `Date` → строка `YYYY-MM-DD` (по локальному времени). */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Строка `YYYY-MM-DD` → локальный `Date` (полночь). */
export const parseYmd = (s: string) => {
  const [y, m, dd] = s.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, dd)
}

export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const addMonths = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(1)
  x.setMonth(x.getMonth() + n)
  return x
}

/** Начало недели для даты `d` с учётом первого дня недели. */
export const startOfWeek = (d: Date, weekStart: WeekStart) => {
  const ws = weekStart === 'Monday' ? 1 : 0
  const x = new Date(d)
  return addDays(x, -((x.getDay() - ws + 7) % 7))
}

/** Порядок индексов дней недели (Date.getDay()) с учётом первого дня недели. */
export const dowOrder = (weekStart: WeekStart) => {
  const ws = weekStart === 'Monday' ? 1 : 0
  return Array.from({ length: 7 }, (_, i) => (i + ws) % 7)
}

/** 42 ячейки сетки месяца, начиная с начала недели первого числа. */
export const monthGrid = (year: number, month: number, weekStart: WeekStart) => {
  const gridStart = startOfWeek(new Date(year, month, 1), weekStart)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

/** Минуты от полуночи → «9:30». */
export const fmtTime = (m: number) => {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}:${pad(mm)}`
}

/** Метка часа для гуттера таймлайна → «09:00». */
export const fmtHour = (h: number) => `${pad(h)}:00`

/** HEX + альфа → строка `rgba(...)`. */
export const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Сортировка событий по времени начала. */
export const sortEvents = (a: CalendarEvent, b: CalendarEvent) => a.start - b.start

/** Сегодняшняя дата (локальная) как `YYYY-MM-DD`. */
export const todayYmd = () => ymd(new Date())

/** Диапазон дат, видимый в текущем режиме — для загрузки уроков. */
export const visibleRange = (
  view: string,
  curr: Date,
  weekStart: WeekStart,
): { from: string; to: string } => {
  if (view === 'day' || view === 'week' || view === 'month') {
    // Всегда сетка месяца (42 дня): точкам-статусам в мини-календаре и
    // недельной полосе нужны события за весь месяц, не только за видимую неделю.
    const gs = startOfWeek(new Date(curr.getFullYear(), curr.getMonth(), 1), weekStart)
    return { from: ymd(gs), to: ymd(addDays(gs, 41)) }
  }
  if (view === 'list') {
    // Ровно текущий месяц (первое — последнее число).
    const first = new Date(curr.getFullYear(), curr.getMonth(), 1)
    const last = new Date(curr.getFullYear(), curr.getMonth() + 1, 0)
    return { from: ymd(first), to: ymd(last) }
  }
  const y = curr.getFullYear()
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

/** Текущее время в минутах от полуночи (локальное). */
export const nowMinutes = () => {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

/** Урок уже закончился (по дате и времени окончания)? */
export const eventPassed = (e: CalendarEvent) => {
  const today = todayYmd()
  return e.date < today || (e.date === today && e.end <= nowMinutes())
}

/**
 * Статус отметки посещаемости урока: зелёный — все отмечены, красный — есть
 * неотмеченные; `null` — статуса нет (урок отменён или ещё не закончился).
 */
export const eventMarkStatus = (e: CalendarEvent): DayStatus | null => {
  if (e.cancelled || !eventPassed(e)) return null
  return e.allMarked ? 'marked' : 'unmarked'
}
