import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { DEMO_SLUG } from '../features/demo/constants'
import { nowInTz, ymdToLocalDate } from './timezone'

export const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
export const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || ''

/** Страница входа — корень auth-поддомена. */
export const signInUrl = `${protocol}://auth.${rootDomain}`

/** Мастер создания первой школы. */
export const onboardingUrl = `${signInUrl}/onboarding`

/**
 * Служебные поддомены: организациями не являются. Читаются в `proxy`
 * (маршрутизация) и в `customSession` (резолв организации по хосту), поэтому
 * живут здесь, а не в `proxy.ts`.
 */
export const RESERVED_SUBDOMAINS = new Set(['auth', 'admin', 'shop', 'docs', 'www'])

/**
 * Что нельзя занять под slug школы. Шире, чем `RESERVED_SUBDOMAINS`: сюда
 * добавлен `demo`, который как раз **является** организацией и обязан
 * резолвиться по поддомену, но занимать его нельзя —
 * `seedDemoOrg()` при каждом сбросе делает
 * `organization.deleteMany({ where: { slug: 'demo' } })`, то есть чужая школа
 * на этом адресе была бы снесена вместе со всеми данными.
 */
export const RESERVED_SLUGS = new Set([...RESERVED_SUBDOMAINS, DEMO_SLUG])

/** Hostname корневого домена без порта */
const rootHostname = rootDomain.split(':')[0]

/**
 * Хост запроса → поддомен (он же slug организации) либо `null` для корневого
 * домена. Чистая строковая функция: вызывается и из `proxy`, и из
 * `customSession`, где `NextRequest` недоступен.
 */
export function extractSubdomain(host: string | null | undefined): string | null {
  const hostname = (host ?? '').split(':')[0] ?? ''

  // localhost: поддомен только при наличии точки перед localhost
  if (hostname.endsWith('.localhost')) {
    return hostname.split('.')[0] ?? null
  }
  if (hostname === 'localhost') {
    return null
  }

  // Preview deployment URLs (tenant---branch-name.vercel.app)
  if (hostname.includes('---') && hostname.endsWith('.vercel.app')) {
    return hostname.split('---')[0] ?? null
  }

  // Проверяем, что hostname - поддомен rootHostname (не сам root и не www)
  if (
    hostname !== rootHostname &&
    hostname !== `www.${rootHostname}` &&
    hostname.endsWith(`.${rootHostname}`)
  ) {
    return hostname.replace(`.${rootHostname}`, '')
  }

  return null
}

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

/**
 * Название → slug: транслит кириллицы, латиница/цифры, дефисы.
 *
 * `trim: false` оставляет дефисы и цифры по краям — режим для `onChange`:
 * при полной нормализации на каждое нажатие дефис исчезал бы в момент набора
 * (`kod-` → `kod`), и ввести `kod-lab` было бы невозможно. Края подрезаем
 * дефолтным `slugify()` перед валидацией и отправкой.
 */
export function slugify(input: string, { trim = true } = {}): string {
  let out = ''
  for (const ch of input.toLowerCase()) {
    if (ch in TRANSLIT) out += TRANSLIT[ch]
    else if (/[a-z0-9]/.test(ch)) out += ch
    else out += '-'
  }
  out = out.replace(/-+/g, '-')
  return trim ? out.replace(/^[^a-z]+/, '').replace(/-+$/, '') : out
}

export const DaysOfWeek = {
  short: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  full: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
}

export function getFullName(firstName: string, lastName: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName
}

export function getGroupName(group: {
  name?: string | null
  course: { name: string }
  schedules: Array<{ dayOfWeek: number; time: string }>
}) {
  if (group.name) return group.name
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
