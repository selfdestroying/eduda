import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { nowInTz, ymdToLocalDate } from './timezone'

export const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
export const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || ''

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DaysOfWeek = {
  short: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  full: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
}

export function getFullName(firstName: string, lastName: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName
}

export function getGroupName(group: {
  course: { name: string }
  schedules: Array<{ dayOfWeek: number; time: string }>
}) {
  const sorted = [...group.schedules].sort(
    (a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7),
  )
  const parts = sorted.map((s) => `${DaysOfWeek.short[s.dayOfWeek]} ${s.time}`)
  return `${group.course.name} ${parts.join(', ')}`
}

// `birthDate` — date-only строка `YYYY-MM-DD`; `today` берём в поясе
// организации, чтобы «сегодня» для возраста считалось по её дню.
export const getAgeFromBirthDate = (birthDate: string, tz: string) => {
  const birth = ymdToLocalDate(birthDate)
  const today = nowInTz(tz)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return age
}
