import { fetchPaidInvoices } from '@/src/features/amocrm/poll'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Опрос amoCRM. Планировщик — системный cron той же машины, раз в десять минут:
 *
 *   flock -n /tmp/amocrm.lock curl -fsS -m 300 -H "X-Poller-Key: …" http://localhost:3001/api/amocrm/poll
 *
 * Снаружи, а не внутри Next: у него нет планировщика, а таймер в памяти процесса
 * умирает с каждым деплоем — ровно так и останавливался прежний парсер, молча и
 * до тех пор, пока кто-нибудь не заметит. `flock` заодно не даёт запускам
 * наложиться, поэтому флаг «уже выполняется» здесь не нужен.
 *
 * Пока роут только читает CRM и показывает, что в ней нашлось: разбор оплаты в
 * счёт и пакет — следующий шаг.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Окно опроса по умолчанию: неделя. Ключ идемпотентности — id счёта, поэтому
 * перекрытие безвредно, а простой парсера лечится сам собой. */
const DEFAULT_WINDOW_DAYS = 7

/** Потолок окна: `since` приходит из запроса, а каждый день — это лишние запросы к CRM. */
const MAX_WINDOW_DAYS = 30

const DAY_SECONDS = 24 * 60 * 60

export async function GET(request: NextRequest) {
  // Роут выставлен наружу вместе со всем приложением (nginx проксирует `/`
  // целиком), поэтому ключ обязателен: без него в `.env` опрос не работает вовсе.
  const key = process.env.AMOCRM_POLL_KEY
  if (!key || request.headers.get('x-poller-key') !== key) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const now = Math.floor(Date.now() / 1000)
  const requested = Number(request.nextUrl.searchParams.get('since'))
  const floor = now - MAX_WINDOW_DAYS * DAY_SECONDS
  const since =
    Number.isFinite(requested) && requested > 0
      ? Math.max(requested, floor)
      : now - DEFAULT_WINDOW_DAYS * DAY_SECONDS

  try {
    const invoices = await fetchPaidInvoices(since)
    return NextResponse.json({ ok: true, since, count: invoices.length, invoices })
  } catch (error) {
    console.error('amocrm/poll: опрос не удался', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
