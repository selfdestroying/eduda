import { importPaidInvoice, type ImportOutcome } from '@/src/features/amocrm/import.server'
import { fetchPaidInvoices } from '@/src/features/amocrm/poll'
import { prisma } from '@repo/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Опрос amoCRM. Планировщик — системный cron той же машины, раз в десять минут:
 *
 *   flock -n /tmp/amocrm.lock curl -fsS -m 300 -H "X-Poller-Key: …" http://localhost:3001/api/amocrm/poll
 *
 * Снаружи, а не внутри Next: у него нет планировщика, а таймер в памяти процесса
 * умирает с каждым деплоем — ровно так и останавливался прежний парсер, молча и
 * до тех пор, пока кто-нибудь не заметит. `flock` заодно не даёт запускам
 * наложиться, поэтому флага «уже выполняется» здесь нет.
 *
 * `?dry=1` — прогон вхолостую: показывает, что завелось бы, и не пишет ничего.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Окно опроса по умолчанию: неделя. Ключ идемпотентности — id счёта, поэтому
 * перекрытие безвредно, а простой парсера лечится сам собой. */
const DEFAULT_WINDOW_DAYS = 7

/** Потолок окна: `since` приходит из запроса, а каждый день — лишние запросы к CRM. */
const MAX_WINDOW_DAYS = 30

const DAY_SECONDS = 24 * 60 * 60

/** Школа, чью CRM опрашиваем. Одна на установку — как и сами креды amo. */
async function pollingOrganization() {
  const id = Number(process.env.AMOCRM_ORGANIZATION_ID)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('AMOCRM_ORGANIZATION_ID не задан — непонятно, чьи оплаты забирать')
  }

  const organization = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, timezone: true },
  })
  if (!organization) {
    throw new Error(`Школа ${id} из AMOCRM_ORGANIZATION_ID не найдена`)
  }

  return organization
}

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

  const dryRun = request.nextUrl.searchParams.get('dry') === '1'

  try {
    const organization = await pollingOrganization()
    const invoices = await fetchPaidInvoices(since)

    // По одному, а не пачкой: каждая оплата — своя транзакция, и счёт, который не
    // сопоставился, не должен утаскивать за собой те, что сопоставились.
    const results: ImportOutcome[] = []
    for (const invoice of invoices) {
      results.push(
        await importPaidInvoice(invoice, {
          organizationId: organization.id,
          tz: organization.timezone,
          dryRun,
        }),
      )
    }

    const count = (status: ImportOutcome['status']) =>
      results.filter((result) => result.status === status).length

    return NextResponse.json({
      ok: true,
      since,
      dryRun,
      fetched: invoices.length,
      imported: count('imported'),
      planned: count('planned'),
      skipped: count('skipped'),
      unprocessed: count('unprocessed'),
      // Пропущенные не показываем: в недельном окне их сотни, и за ними не видно
      // того, ради чего в ответ вообще смотрят.
      results: results.filter((result) => result.status !== 'skipped'),
    })
  } catch (error) {
    console.error('amocrm/poll: опрос не удался', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
