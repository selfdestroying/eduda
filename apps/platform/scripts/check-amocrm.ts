/**
 * Что опрос сделает с оплатами из amoCRM: тянет оплаченные счета за период и
 * прогоняет их через настоящий разбор вхолостую. Ничего не пишет — ни в CRM, ни
 * в базу.
 *
 * Он же предполётная сверка справочника: строки «товар не привязан» — это ровно
 * те продукты, которым школе нужно проставить `externalId`, с готовым номером.
 *
 *   pnpm --filter platform exec tsx scripts/check-amocrm.ts [дней]
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import { planImport } from '../src/features/amocrm/import.server'
import { fetchPaidInvoices } from '../src/features/amocrm/poll'

const days = Number(process.argv[2]) || 7
const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60

async function main() {
  if (!process.env.AMOCRM_SUBDOMAIN || !process.env.AMOCRM_TOKEN) {
    throw new Error('В apps/platform/.env нет AMOCRM_SUBDOMAIN и AMOCRM_TOKEN')
  }

  const organizationId = Number(process.env.AMOCRM_ORGANIZATION_ID)
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    throw new Error('В apps/platform/.env нет AMOCRM_ORGANIZATION_ID')
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, timezone: true },
  })
  if (!organization) throw new Error(`Школа ${organizationId} не найдена`)

  console.log(
    `${organization.name}: оплаченные счета за ${days} дн. ` +
      `(с ${new Date(since * 1000).toISOString().slice(0, 10)})\n`,
  )

  const invoices = await fetchPaidInvoices(since)
  const reasons = new Map<string, number>()
  let planned = 0

  for (const invoice of invoices) {
    const paid = new Date(invoice.paidAt * 1000).toISOString().slice(0, 10)
    console.log(
      `#${invoice.invoiceId}  ${paid}  ${invoice.total ?? '—'} ₽  ${invoice.leadName ?? '— без сделки'}`,
    )

    // Фильтр запроса обязан отсекать старое: на нём держится размер окна опроса.
    assert.ok(invoice.paidAt >= since, `счёт ${invoice.invoiceId} старше запрошенного окна`)
    // Ключ идемпотентности: без него повторный опрос заведёт оплату второй раз.
    assert.ok(Number.isInteger(invoice.invoiceId), 'у счёта нет числового id')

    // Разбор идёт в транзакции только потому, что `planImport` принимает клиента
    // транзакции: писать ему нечего, и откатывать нечего.
    const result = await prisma.$transaction((tx) =>
      planImport(tx, invoice, { organizationId, tz: organization.timezone }),
    )

    if (!result.ok) {
      console.log(`  ✗ ${result.reason}`)
      reasons.set(result.reason, (reasons.get(result.reason) ?? 0) + 1)
      continue
    }

    planned += 1
    const packages = result.plan.packages
      .map((packet) => `${packet.productName} — ${packet.lessonCount} зан. за ${packet.price} ₽`)
      .join('; ')
    console.log(
      `  ✓ ${result.plan.studentName}, кошелёк ${result.plan.walletId}, ${result.plan.date}`,
    )
    console.log(`    ${packages}`)
  }

  console.log(`\nЗаведётся автоматически: ${planned} из ${invoices.length}`)

  if (reasons.size > 0) {
    console.log('\nУйдёт в разбор руками:')
    for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(3)}  ${reason}`)
    }
  }

  await reportUnlinkedProducts(invoices)
}

/**
 * Товары CRM, которым не сопоставлен продукт школы, — отдельным проходом по всем
 * позициям, а не по причинам отказа.
 *
 * Разбор останавливается на первой же нестыковке, и до товара он не доходит, если
 * раньше не выбрался кошелёк. Список для сверки справочника от этого получался бы
 * неполным, а нужен он целиком: по нему школа проставляет номера.
 */
async function reportUnlinkedProducts(invoices: Awaited<ReturnType<typeof fetchPaidInvoices>>) {
  const organizationId = Number(process.env.AMOCRM_ORGANIZATION_ID)
  const seen = new Map<number, { name: string; count: number }>()

  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const entry = seen.get(item.productId)
      if (entry) entry.count += 1
      else seen.set(item.productId, { name: item.name, count: 1 })
    }
  }

  const linked = await prisma.product.findMany({
    where: { organizationId, externalId: { in: [...seen.keys()] } },
    select: { externalId: true },
  })
  for (const product of linked) {
    if (product.externalId !== null) seen.delete(product.externalId)
  }

  if (seen.size === 0) {
    console.log('\nВсе товары CRM привязаны к продуктам.')
    return
  }

  console.log('\nТовары CRM без продукта школы — проставить номер в карточке продукта:')
  for (const [productId, { name, count }] of [...seen].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${String(count).padStart(3)} поз.  ${productId}  ${name}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
