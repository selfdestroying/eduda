/**
 * Клиент amoCRM: единственное место, которое ходит в CRM.
 *
 * Аккаунт у школы один, а токен долгоживущий, поэтому поддомен и токен лежат в
 * `.env`. Появится вторая школа с amoCRM — креды переедут в базу; сегодня это
 * была бы таблица на одну строку.
 */
import type { AmoEvent, AmoEventsResponse, AmoInvoice, AmoLead, AmoLinksResponse } from './types'

/**
 * Каталог счетов и его поля. Идентификаторы принадлежат аккаунту, а не amoCRM: в
 * другом аккаунте они будут другими, и спрашивать их придётся у `GET /catalogs`.
 * Пока аккаунт один, константы честнее запроса, который всегда вернёт одно и то же.
 */
export const INVOICES_CATALOG_ID = 9405

export const INVOICE_FIELD = {
  /** «Позиции счета» — что купили. */
  items: 891565,
  /** «Плательщик» — родитель: имя, телефон, id контакта. */
  payer: 891559,
  /** «Стоимость» — сколько по счёту заплатили на самом деле. */
  total: 891569,
  /** «Дата оплаты» — бизнес-день оплаты, а не день, когда её заметили. */
  paidAt: 891563,
} as const

/** Пауза между запросами: amo ограничивает частоту обращений. */
const REQUEST_DELAY_MS = 500

/** Потолок листания: 100 событий на страницу, то есть 5000 событий за опрос. */
const MAX_PAGES = 50

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Креды читаются на вызове, а не при вычислении модуля: без этого приложение без
 * интеграции с amo не собралось бы и не поднялось.
 */
function credentials() {
  const subdomain = process.env.AMOCRM_SUBDOMAIN
  const token = process.env.AMOCRM_TOKEN
  if (!subdomain || !token) {
    throw new Error('AMOCRM_SUBDOMAIN и AMOCRM_TOKEN не заданы — опрос amoCRM невозможен')
  }
  return { subdomain, token }
}

const apiUrl = (path: string) => `https://${credentials().subdomain}.amocrm.ru/api/v4${path}`

/**
 * Запрос к amo. `null` — «ничего не нашлось»: пустую выборку CRM отдаёт как 204,
 * и это не ошибка.
 */
async function request<T>(url: string): Promise<T | null> {
  const { token } = credentials()

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  await delay(REQUEST_DELAY_MS)

  if (response.status === 204) return null
  if (!response.ok) {
    // В текст ошибки идёт только путь: в строке запроса лежат фильтры, а в
    // заголовке — токен, и ни тому, ни другому не место в логах.
    throw new Error(`amoCRM ${response.status} ${response.statusText}: ${new URL(url).pathname}`)
  }

  return (await response.json()) as T
}

/**
 * События «счёт оплачен» начиная с `since` (unix-секунды, включительно).
 *
 * Страницы идём до конца по `_links.next`. За десять минут больше страницы не
 * набирается, но окно опроса — неделя, и после долгого простоя хвост иначе
 * потерялся бы молча.
 */
export async function fetchPaidInvoiceEvents(since: number): Promise<AmoEvent[]> {
  const params = new URLSearchParams({
    'filter[type]': 'invoice_paid',
    'filter[created_at][from]': String(since),
    limit: '100',
  })

  let url = apiUrl(`/events?${params}`)
  const events: AmoEvent[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await request<AmoEventsResponse>(url)
    if (!response) break

    events.push(...(response._embedded?.events ?? []))

    const next = response._links?.next?.href
    if (!next) break
    url = next
  }

  return events
}

export async function fetchInvoice(id: number): Promise<AmoInvoice | null> {
  return await request<AmoInvoice>(apiUrl(`/catalogs/${INVOICES_CATALOG_ID}/elements/${id}`))
}

/** Сделка, к которой привязан счёт. Её название — единственный источник имени ученика. */
export async function fetchInvoiceLeadId(invoiceId: number): Promise<number | null> {
  const params = new URLSearchParams({ 'filter[to_entity_type]': 'leads' })
  const response = await request<AmoLinksResponse>(
    apiUrl(`/catalogs/${INVOICES_CATALOG_ID}/elements/${invoiceId}/links?${params}`),
  )

  return response?._embedded?.links?.[0]?.to_entity_id ?? null
}

/** Удалённая сделка отдаёт 204 — счёт останется без имени, разбирать его будут руками. */
export async function fetchLead(id: number): Promise<AmoLead | null> {
  return await request<AmoLead>(apiUrl(`/leads/${id}`))
}
