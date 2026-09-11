/**
 * Самопроверка опроса amoCRM без сети: вместо CRM — подменённый `fetch`.
 *
 * Держит две вещи, от которых зависит, доходит ли проход до конца:
 * - счёт, которым уже занимались, в CRM не запрашивается вовсе;
 * - сетевой сбой повторяется один раз, а второй подряд уходит наружу.
 *
 * Живую сверку с настоящей CRM делает `check-amocrm.ts`.
 *
 *   pnpm --filter platform exec tsx scripts/check-amocrm-client.ts
 */
import assert from 'node:assert/strict'
import { fetchPaidInvoices } from '../src/features/amocrm/poll'

process.env.AMOCRM_SUBDOMAIN = 'check'
process.env.AMOCRM_TOKEN = 'check-token'

/** Пути запросов по порядку — по ним и видно, куда опрос ходил. */
const requests: string[] = []
/** Сколько ближайших запросов оборвать — так amo обрывает закрытое соединение. */
let drops = 0

globalThis.fetch = (async (input: string | URL | Request) => {
  const { pathname } = new URL(input instanceof Request ? input.url : input)
  requests.push(pathname)

  if (drops > 0) {
    drops -= 1
    throw new TypeError('fetch failed')
  }

  if (pathname.endsWith('/events')) {
    return Response.json({
      _embedded: {
        events: [
          { created_at: 200, _embedded: { entity: { id: 2 } } },
          { created_at: 100, _embedded: { entity: { id: 1 } } },
        ],
      },
    })
  }
  if (pathname.endsWith('/links')) {
    return Response.json({ _embedded: { links: [{ to_entity_id: 10 }] } })
  }
  if (pathname.includes('/leads/')) return Response.json({ id: 10, name: 'Иван Петров' })
  if (pathname.includes('/elements/')) {
    return Response.json({ id: Number(pathname.split('/').pop()), custom_fields_values: [] })
  }
  return new Response(null, { status: 404 })
}) as unknown as typeof fetch

async function main() {
  // Первый же запрос попадает на соединение, которое amo уже закрыла.
  drops = 1
  const invoices = await fetchPaidInvoices(0, { skip: async (invoiceId) => invoiceId === 2 })

  assert.deepEqual(
    invoices.map((invoice) => invoice.invoiceId),
    [1],
    'заведённый счёт отсеян, новый скачан',
  )
  assert.equal(invoices[0]!.leadName, 'Иван Петров', 'детали нового счёта на месте')
  assert.ok(
    !requests.some((path) => /\/elements\/2(\/|$)/.test(path)),
    'по заведённому счёту в CRM не ходили',
  )
  assert.equal(
    requests.filter((path) => path.endsWith('/events')).length,
    2,
    'оборванный запрос повторён один раз',
  )
  assert.equal(requests.length, 5, 'список событий с повтором и три запроса на новый счёт')

  // Два сбоя подряд — уже не закрытое соединение: проход падает, а не крутится.
  drops = 2
  await assert.rejects(
    () => fetchPaidInvoices(0),
    /fetch failed/,
    'второй сбой подряд уходит наружу',
  )

  console.log('check-amocrm-client: всё сошлось')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
