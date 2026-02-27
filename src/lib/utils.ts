import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Prisma } from '../../prisma/generated/client'
import { moscowNow } from './timezone'

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

export function getGroupName(
  group: Prisma.GroupGetPayload<{ include: { location: true; course: true } }> & {
    schedules?: Array<{ dayOfWeek: number; time: string }>
  }
) {
  if (group.schedules && group.schedules.length > 0) {
    const sorted = [...group.schedules].sort(
      (a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7)
    )
    const parts = sorted.map((s) => `${DaysOfWeek.short[s.dayOfWeek]} ${s.time}`)
    return `${group.course.name} ${parts.join(', ')}`
  }
  return `${group.course.name} ${DaysOfWeek.short[group.dayOfWeek!]} ${group.time}`
}

export const getAgeFromBirthDate = (birthDate: Date) => {
  const today = moscowNow()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  return age
}
