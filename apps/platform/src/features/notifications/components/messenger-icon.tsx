import { cn } from '@/src/lib/utils'

/**
 * Значок MAX. Инлайном, а не файлом в `public/`: разметки здесь на десяток
 * строк, а `<img>` — это лишний запрос.
 *
 * Идентификаторы градиентов неймспейснуты (`max-*`): значок может встретиться в
 * документе не один раз, и голые `a`/`b`/`c` столкнулись бы с чем угодно ещё.
 */
export function MaxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" className={cn('size-5 rounded-sm', className)} aria-hidden>
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
