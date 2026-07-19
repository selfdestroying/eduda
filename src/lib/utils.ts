import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { nowInTz, ymdToLocalDate } from './timezone'

export const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
export const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || ''

/** Страница входа — корень auth-поддомена. */
export const signInUrl = `${protocol}://auth.${rootDomain}`

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Сумма в рублях без копеек, напр. «1 234 ₽».
 */
export function formatCurrency(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

/** Название → slug: транслит кириллицы, латиница/цифры, дефисы. */
export function slugify(input: string): string {
  let out = ''
  for (const ch of input.toLowerCase()) {
    if (ch in TRANSLIT) out += TRANSLIT[ch]
    else if (/[a-z0-9]/.test(ch)) out += ch
    else out += '-'
  }
  return out
    .replace(/-+/g, '-')
    .replace(/^[^a-z]+/, '')
    .replace(/-+$/, '')
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
