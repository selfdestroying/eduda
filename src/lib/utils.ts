import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { nowInTz } from './timezone'

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

export const getAgeFromBirthDate = (birthDate: Date, tz: string) => {
  // `today` — стеночасы пояса организации (локальные геттеры = дата зоны);
  // `birthDate` (@db.Date, UTC-полночь) читаем через getUTC*, иначе к западу
  // от UTC день «съезжает» на предыдущий → off-by-one в возрасте.
  const today = nowInTz(tz)
  let age = today.getFullYear() - birthDate.getUTCFullYear()
  const monthDiff = today.getMonth() - birthDate.getUTCMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getUTCDate())) {
    age--
  }

  return age
}
