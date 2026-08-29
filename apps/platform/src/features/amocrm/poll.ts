/**
 * Оплаты из amoCRM в том виде, в каком их разбирает платформа.
 *
 * Здесь только чтение: превращение оплаты в счёт и пакет — отдельный шаг, и живёт
 * он в денежном ядре (`finances/ledger.server.ts`), а не рядом с HTTP-клиентом.
 *
 * Опрос идёт скользящим окном, а не курсором «с чего продолжили». Ключ
 * идемпотентности — id счёта, поэтому повторно увиденная оплата ничего не портит,
 * а простой парсера или сбой CRM лечится сам собой на следующем запуске. Файла
 * состояния, который переживал бы деплой, при этом не нужно вовсе.
 */
import {
  fetchInvoice,
  fetchInvoiceLeadId,
  fetchLead,
  fetchPaidInvoiceEvents,
  INVOICE_FIELD,
} from './client'
import type { AmoFieldValue, AmoInvoice, AmoInvoiceItem, AmoPayer } from './types'

export type PaidInvoiceItem = {
  /** id товара в каталоге amo — по нему ищется продукт школы. */
  productId: number
  name: string
  unitPrice: number
  quantity: number
  total: number
}

/** Оплаченный счёт: всё, что нужно, чтобы завести пару «счёт + пакет». */
export type PaidInvoice = {
  /** Элемент каталога счетов. Ключ идемпотентности: один счёт — одна оплата. */
  invoiceId: number
  /** Когда amo отметила счёт оплаченным (unix-секунды). */
  paidAt: number
  /**
   * Дата оплаты с самого счёта. Отличается от `paidAt`, когда оплату проводят
   * задним числом, и именно она должна стать бизнес-днём оплаты.
   */
  paymentDate: number | null
  /** Название сделки: «Имя Фамилия» ученика. По нему его и ищут. */
  leadId: number | null
  leadName: string | null
  /** Плательщик — родитель. Для поиска ученика не годится, для разбора руками — да. */
  payerName: string | null
  payerPhone: string | null
  /** Сумма по счёту: сколько заплатили на самом деле, а не сколько стоит продукт. */
  total: number | null
  items: PaidInvoiceItem[]
}

const fieldValues = (invoice: AmoInvoice, fieldId: number): unknown[] =>
  invoice.custom_fields_values?.find((field) => field.field_id === fieldId)?.values ?? []

/** Число из поля amo: суммы приезжают строками («5990»). */
function numericField(invoice: AmoInvoice, fieldId: number): number | null {
  const raw = (fieldValues(invoice, fieldId)[0] as AmoFieldValue<string | number> | undefined)
    ?.value
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function items(invoice: AmoInvoice): PaidInvoiceItem[] {
  const values = fieldValues(invoice, INVOICE_FIELD.items) as AmoFieldValue<AmoInvoiceItem>[]

  return values.map(({ value }) => ({
    productId: value.product_id,
    name: value.description,
    unitPrice: value.unit_price,
    // Количество amo считает штуками товара, а не занятиями: две штуки абонемента
    // на 4 занятия — это 8 занятий.
    quantity: value.quantity,
    total: value.total_sum,
  }))
}

/**
 * Оплаченные счета, начиная с `since` (unix-секунды).
 *
 * На каждый счёт уходит три запроса к CRM, и между ними стоит пауза, так что
 * десяток оплат — это полминуты. Для опроса раз в десять минут этого достаточно,
 * а параллелить запросы к amo нельзя: она ограничивает частоту.
 *
 * Сделка, которую в CRM удалили, счёт не отменяет: он вернётся без имени и уйдёт
 * в разбор руками — там видно плательщика и телефон.
 */
export async function fetchPaidInvoices(since: number): Promise<PaidInvoice[]> {
  const events = await fetchPaidInvoiceEvents(since)

  const paid: PaidInvoice[] = []

  for (const event of events) {
    const invoice = await fetchInvoice(event._embedded.entity.id)
    if (!invoice) continue

    const leadId = await fetchInvoiceLeadId(invoice.id)
    const lead = leadId ? await fetchLead(leadId) : null
    const payer = (
      fieldValues(invoice, INVOICE_FIELD.payer)[0] as AmoFieldValue<AmoPayer> | undefined
    )?.value

    paid.push({
      invoiceId: invoice.id,
      paidAt: event.created_at,
      paymentDate: numericField(invoice, INVOICE_FIELD.paidAt),
      leadId,
      leadName: lead?.name ?? null,
      payerName: payer?.name ?? null,
      payerPhone: payer?.phone ?? null,
      total: numericField(invoice, INVOICE_FIELD.total),
      items: items(invoice),
    })
  }

  // По возрастанию даты оплаты: пакеты встают в очередь кошелька по дате, и
  // разбирать их в том же порядке, в каком они случились, — единственный, при
  // котором очередь совпадает с реальностью.
  return paid.sort((a, b) => a.paidAt - b.paidAt)
}
