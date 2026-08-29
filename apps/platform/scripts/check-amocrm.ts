/**
 * Что платформа видит в amoCRM: тянет оплаченные счета за период и печатает
 * разбор. Ничего не пишет — ни в CRM, ни в базу.
 *
 * Проверяет то, на чём держится клиент: фильтр по дате отдаёт события «от и
 * новее», у счёта находятся позиции, сумма и дата оплаты, а у сделки — имя.
 *
 *   pnpm --filter platform exec tsx scripts/check-amocrm.ts [дней]
 */
import './load-env'

import assert from 'node:assert/strict'
import { fetchPaidInvoices } from '../src/features/amocrm/poll'

const days = Number(process.argv[2]) || 7
const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60

async function main() {
  if (!process.env.AMOCRM_SUBDOMAIN || !process.env.AMOCRM_TOKEN) {
    throw new Error('В apps/platform/.env нет AMOCRM_SUBDOMAIN и AMOCRM_TOKEN')
  }

  console.log(`Оплаченные счета за ${days} дн. (с ${new Date(since * 1000).toISOString()})\n`)
  const invoices = await fetchPaidInvoices(since)

  for (const invoice of invoices) {
    const paid = new Date(invoice.paidAt * 1000).toISOString().slice(0, 10)
    const items = invoice.items
      .map((item) => `[${item.productId}] ${item.name} ×${item.quantity} = ${item.total} ₽`)
      .join('; ')

    console.log(`#${invoice.invoiceId}  ${paid}  ${invoice.total ?? '—'} ₽`)
    console.log(`  сделка:     ${invoice.leadName ?? '— (удалена или не привязана)'}`)
    console.log(`  плательщик: ${invoice.payerName ?? '—'} ${invoice.payerPhone ?? ''}`)
    console.log(`  позиции:    ${items || '—'}`)

    // Фильтр запроса обязан отсекать старое: на нём держится размер окна опроса.
    assert.ok(invoice.paidAt >= since, `счёт ${invoice.invoiceId} старше запрошенного окна`)
    // Ключ идемпотентности: без него повторный опрос заведёт оплату второй раз.
    assert.ok(Number.isInteger(invoice.invoiceId), 'у счёта нет числового id')
  }

  console.log(`\nВсего: ${invoices.length}`)

  const nameless = invoices.filter((invoice) => !invoice.leadName).length
  const emptyItems = invoices.filter((invoice) => invoice.items.length === 0).length
  const noDate = invoices.filter((invoice) => invoice.paymentDate === null).length
  const multiItem = invoices.filter((invoice) => invoice.items.length > 1).length

  // Не ошибки, а то, что придётся разбирать руками: пусть цифры будут видны сразу.
  console.log(`Без имени сделки: ${nameless}`)
  console.log(`Без позиций:      ${emptyItems}`)
  console.log(`Без даты оплаты:  ${noDate}`)
  console.log(`Больше одной позиции: ${multiItem}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
