import type { MessengerProvider } from '@repo/db/browser'
import { cn } from '@/src/lib/utils'

/**
 * Значки мессенджеров. Инлайном, а не файлами в `public/`: два `<img>` на
 * строку таблицы — это два запроса на каждую строку, а разметки здесь на
 * десяток строк.
 *
 * Идентификаторы градиентов MAX неймспейснуты (`max-*`): в документе значок
 * встречается много раз, и голые `a`/`b`/`c` столкнулись бы с чем угодно ещё.
 */

export const MESSENGER_NAME: Record<MessengerProvider, string> = {
  VK: 'ВКонтакте',
  MAX: 'MAX',
}

function VkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d="M0 48C0 25.3726 0 14.0589 7.02944 7.02944C14.0589 0 25.3726 0 48 0H52C74.6274 0 85.9411 0 92.9706 7.02944C100 14.0589 100 25.3726 100 48V52C100 74.6274 100 85.9411 92.9706 92.9706C85.9411 100 74.6274 100 52 100H48C25.3726 100 14.0589 100 7.02944 92.9706C0 85.9411 0 74.6274 0 52V48Z"
        fill="#0077FF"
      />
      <path
        d="M53.2083 72.042C30.4167 72.042 17.4168 56.417 16.8751 30.417H28.2917C28.6667 49.5003 37.0833 57.5836 43.7499 59.2503V30.417H54.5002V46.8752C61.0836 46.1669 67.9994 38.667 70.3328 30.417H81.0831C79.2914 40.5837 71.7914 48.0836 66.458 51.1669C71.7914 53.6669 80.3335 60.2086 83.5835 72.042H71.7498C69.2081 64.1253 62.8752 58.0003 54.5002 57.1669V72.042H53.2083Z"
        fill="white"
      />
    </svg>
  )
}

function MaxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" className={className} aria-hidden>
      <defs>
        <linearGradient id="max-b">
          <stop offset="0" stopColor="#00f" />
          <stop offset="1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="max-a">
          <stop offset="0" stopColor="#4cf" />
          <stop offset=".662" stopColor="#53e" />
          <stop offset="1" stopColor="#93d" />
        </linearGradient>
        <linearGradient
          id="max-c"
          x1="117.847"
          x2="1000"
          y1="760.536"
          y2="500"
          gradientUnits="userSpaceOnUse"
          href="#max-a"
        />
        <radialGradient
          id="max-d"
          cx="-87.392"
          cy="1166.116"
          r="500"
          fx="-87.392"
          fy="1166.116"
          gradientTransform="rotate(51.356 1551.478 559.3)scale(2.42703433 1)"
          gradientUnits="userSpaceOnUse"
          href="#max-b"
        />
      </defs>
      <rect width="1000" height="1000" fill="url(#max-c)" ry="249.681" />
      <rect width="1000" height="1000" fill="url(#max-d)" ry="249.681" />
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M508.211 878.328c-75.007 0-109.864-10.95-170.453-54.75-38.325 49.275-159.686 87.783-164.979 21.9 0-49.456-10.95-91.248-23.36-136.873-14.782-56.21-31.572-118.807-31.572-209.508 0-216.626 177.754-379.597 388.357-379.597 210.785 0 375.947 171.001 375.947 381.604.707 207.346-166.595 376.118-373.94 377.224m3.103-571.585c-102.564-5.292-182.499 65.7-200.201 177.024-14.6 92.162 11.315 204.398 33.397 210.238 10.585 2.555 37.23-18.98 53.837-35.587a189.8 189.8 0 0 0 92.71 33.032c106.273 5.112 197.08-75.794 204.215-181.95 4.154-106.382-77.67-196.486-183.958-202.574Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function MessengerIcon({
  provider,
  className,
  hideLabel,
}: {
  provider: MessengerProvider
  className?: string
  /** Название рядом уже написано словами — второй раз его читать не надо. */
  hideLabel?: boolean
}) {
  const Icon = provider === 'VK' ? VkIcon : MaxIcon
  const name = MESSENGER_NAME[provider]

  // Название остаётся в `title`: значок узнаётся не всеми, а колонка узкая.
  return (
    <span title={hideLabel ? undefined : name} className="inline-flex">
      <Icon className={cn('size-5 rounded-[4px]', className)} />
      {!hideLabel && <span className="sr-only">{name}</span>}
    </span>
  )
}
