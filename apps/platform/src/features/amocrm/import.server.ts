/**
 * Оплата из amoCRM превращается в счёт с пакетами.
 *
 * Вся денежная часть делается денежным ядром: счёт и пакеты заводятся так же, как
 * их заводит менеджер руками, и выдаются через `activatePackageTx`. Значит и
 * очередь списания, и журнал, и гашение занятий, которые ждали оплаты, получаются
 * теми же самыми. Своей арифметики здесь нет ни строчки — только сопоставление
 * того, что приехало из CRM, с тем, что есть в базе.
 *
 * Разбор отделён от записи (`planImport` / `importPaidInvoice`): по тому же плану
 * идёт прогон вхолостую, поэтому «что будет» и «что произошло» считаются одним
 * кодом и разойтись не могут.
 *
 * Не сопоставилось — оплата уходит в разбор руками (`UnprocessedPayment`), где её
 * ждёт готовая форма. Догадки здесь неуместны: цена ошибки — деньги в чужом
 * кошельке.
 */
import { activatePackageTx, unitPriceOf } from '@/src/features/finances/ledger.server'
import { formatInTz } from '@/src/lib/timezone'
import { Prisma, prisma, StudentStatus } from '@repo/db'
import type { PaidInvoice } from './poll'

/**
 * Оплата закрывает занятия, которые её ждали, а каждое — отдельное списание со
 * своим журналом. У ученика, который долго ходил без оплаты, таких десятки, и в
 * дефолтные пять секунд Prisma длинный хвост не укладывается. В
 * `payments/actions.ts` стоит столько же и по той же причине.
 */
const IMPORT_TX_OPTIONS = { timeout: 30_000 }

type PlannedPackage = {
  productId: number
  productName: string
  lessonCount: number
  price: number
}

export type ImportPlan = {
  studentId: number
  studentName: string
  walletId: number
  /** Бизнес-день оплаты: по нему пакет встаёт в очередь кошелька. */
  date: string
  price: number
  packages: PlannedPackage[]
}

export type ImportOutcome =
  | { status: 'imported'; invoiceId: number; paymentId: number; settled: number }
  | { status: 'planned'; invoiceId: number; plan: ImportPlan }
  | { status: 'skipped'; invoiceId: number }
  | { status: 'unprocessed'; invoiceId: number; reason: string }

/**
 * Счётом уже занимались?
 *
 * Два условия, и оба обязательны. `Payment.externalId` закрывает и то, что завёл
 * опрос, и то, что разобрал человек — `resolveUnprocessedPayment` проставляет его
 * из той же CRM-записи. Открытая строка разбора закрывает случай «ждём решения
 * человека»: без неё скользящее окно плодило бы её заново каждые десять минут.
 *
 * Отсюда полезный жест: удалить строку разбора значит «попробовать ещё раз» —
 * ближайший опрос подберёт счёт снова, уже с исправленным справочником.
 */
async function alreadyHandledTx(
  tx: Prisma.TransactionClient,
  args: { organizationId: number; invoiceId: number },
): Promise<boolean> {
  const payment = await tx.payment.findFirst({
    where: { organizationId: args.organizationId, externalId: args.invoiceId },
    select: { id: true },
  })
  if (payment) return true

  // Поиск по JSON, а не по колонке: id счёта уже лежит в `rawData` целиком, и
  // вторая копия того же числа рядом ничего не добавит. Строк тут сотни, а опрос
  // раз в десять минут — перебор дешевле индекса, который придётся поддерживать.
  // Строки прежнего парсера ключа не содержат и просто не совпадут: все они
  // давно разобраны.
  const unprocessed = await tx.unprocessedPayment.findFirst({
    where: {
      organizationId: args.organizationId,
      resolved: false,
      rawData: { path: ['invoiceId'], equals: args.invoiceId },
    },
    select: { id: true },
  })

  return Boolean(unprocessed)
}

/**
 * Id счёта CRM из сохранённой сырой оплаты.
 *
 * `null` — строку написал прежний парсер, у которого такого ключа не было. Живёт
 * рядом с `alreadyHandledTx`, потому что оба знают одно и то же про форму
 * `rawData`, и разъехаться им нельзя.
 */
export function invoiceIdOfRawData(rawData: Prisma.JsonValue | null): number | null {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return null
  const value = (rawData as Record<string, unknown>).invoiceId
  return typeof value === 'number' ? value : null
}

/**
 * Ученики, подходящие под название сделки: «Фамилия Имя курс год» или «Имя
 * Фамилия курс год» — порядок в CRM плавает, поэтому пробуем оба. Дальше первых
 * двух слов не идём: там название курса и учебный год.
 */
async function findStudentsTx(
  tx: Prisma.TransactionClient,
  args: { organizationId: number; leadName: string },
) {
  const parts = args.leadName
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2) return []

  const [first, second] = parts
  const insensitive = Prisma.QueryMode.insensitive

  return await tx.student.findMany({
    where: {
      organizationId: args.organizationId,
      OR: [
        {
          firstName: { equals: first, mode: insensitive },
          lastName: { equals: second, mode: insensitive },
        },
        {
          firstName: { equals: second, mode: insensitive },
          lastName: { equals: first, mode: insensitive },
        },
      ],
    },
    select: { id: true, firstName: true, lastName: true },
    // Двух достаточно: нужен не список, а ответ «ровно один или нет».
    take: 2,
  })
}

/**
 * Кошелёк, в который идут деньги, — или `null`, если выбрать нельзя.
 *
 * Один активный кошелёк — берём его. Дальше начинается настоящая неоднозначность:
 * школа заводит новый кошелёк под сезон, а прежний оставляет активным с нулевым
 * балансом, так что у вернувшегося ученика их обычно два.
 *
 * Развязывает её запись в группу. Ученик платит за то, на что ходит: если занятия
 * сейчас списываются ровно с одного кошелька, топливо нужно ему. Это не догадка
 * про курс по названию сделки, а наблюдаемый факт про то, какой кошелёк тратится.
 * На дампе прода правило снимает 116 случаев из 234 — половину ручной стопки.
 *
 * Ходит в две группы разом (и в оба кошелька) — выбор за человеком: ошибка здесь
 * кладёт деньги не за тот курс.
 */
function pickWallet<T extends { id: number; _count: { studentGroups: number } }>(
  wallets: T[],
): T | null {
  if (wallets.length === 1) return wallets[0] ?? null

  const enrolled = wallets.filter((wallet) => wallet._count.studentGroups > 0)
  return enrolled.length === 1 ? (enrolled[0] ?? null) : null
}

/**
 * План импорта или причина отказа. Ничего не пишет — на этом держится прогон
 * вхолостую.
 */
export async function planImport(
  tx: Prisma.TransactionClient,
  invoice: PaidInvoice,
  args: { organizationId: number; tz: string },
): Promise<{ ok: true; plan: ImportPlan } | { ok: false; reason: string; studentId?: number }> {
  if (invoice.items.length === 0) {
    return { ok: false, reason: 'В счёте нет ни одной позиции' }
  }

  if (!invoice.leadName) {
    return { ok: false, reason: 'У счёта нет сделки — имя ученика взять неоткуда' }
  }

  const students = await findStudentsTx(tx, {
    organizationId: args.organizationId,
    leadName: invoice.leadName,
  })
  const [student] = students
  if (!student) {
    return { ok: false, reason: `Ученик не найден по названию сделки «${invoice.leadName}»` }
  }
  // Прежний парсер брал первого попавшегося. Двое однофамильцев с одинаковым
  // именем в школе на девятьсот учеников — не редкость, а ошибка здесь кладёт
  // деньги в чужой кошелёк.
  if (students.length > 1) {
    return { ok: false, reason: `Под «${invoice.leadName}» подходит несколько учеников` }
  }

  // Кошелёк, а не группа: у ученика из двух групп на одном абонементе выбирать не
  // из чего, и прежний отказ «состоит в нескольких группах» был ложной тревогой.
  const wallets = await tx.wallet.findMany({
    where: { studentId: student.id, organizationId: args.organizationId, status: 'ACTIVE' },
    select: {
      id: true,
      _count: { select: { studentGroups: { where: { status: StudentStatus.ACTIVE } } } },
    },
  })
  const wallet = pickWallet(wallets)
  if (!wallet) {
    return {
      ok: false,
      reason:
        wallets.length === 0
          ? 'У ученика нет активного кошелька'
          : 'У ученика несколько кошельков — за какой курс оплата, из счёта не видно',
      studentId: student.id,
    }
  }

  const packages: PlannedPackage[] = []
  for (const item of invoice.items) {
    const product = await tx.product.findFirst({
      where: { organizationId: args.organizationId, externalId: item.productId },
      select: { id: true, name: true, lessonCount: true },
    })
    if (!product) {
      return {
        ok: false,
        reason: `Товар CRM ${item.productId} «${item.name}» не привязан ни к одному продукту`,
        studentId: student.id,
      }
    }

    // Количество в счёте — штуки товара, а не занятия: две штуки абонемента на
    // 4 занятия дают 8. Дробная штука абонемента смысла не имеет.
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return {
        ok: false,
        reason: `Непонятное количество товара «${item.name}»: ${item.quantity}`,
        studentId: student.id,
      }
    }

    packages.push({
      productId: product.id,
      // Снимок названия из справочника школы, а не из счёта: подпись пакета — то,
      // что школа продаёт, а формулировка в CRM живёт своей жизнью.
      productName: product.name,
      lessonCount: product.lessonCount * item.quantity,
      // Деньги из счёта, а не из прайса: платят со скидками и по акциям, а
      // прайсовая цена урока осела бы в проводках занятий навсегда.
      price: item.total,
    })
  }

  // Бизнес-день — дата оплаты со счёта. Она расходится с датой события, когда
  // оплату проводят задним числом, и именно она ставит пакет в очередь кошелька.
  const paidAt = new Date((invoice.paymentDate ?? invoice.paidAt) * 1000)

  return {
    ok: true,
    plan: {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      walletId: wallet.id,
      date: formatInTz(paidAt, args.tz, 'yyyy-MM-dd'),
      // Сумма счёта складывается из позиций, а не берётся из поля «Стоимость»:
      // только так цена счёта сходится с суммой пакетов при любой скидке.
      price: packages.reduce((sum, packet) => sum + packet.price, 0),
      packages,
    },
  }
}

/**
 * Завести оплату. Один счёт CRM — один `Payment`, каждая его позиция — свой
 * `Package`: схема это умеет, поэтому двое детей в одном счёте разбираются штатно.
 */
export async function importPaidInvoice(
  invoice: PaidInvoice,
  args: { organizationId: number; tz: string; dryRun?: boolean },
): Promise<ImportOutcome> {
  return await prisma.$transaction(async (tx): Promise<ImportOutcome> => {
    if (await alreadyHandledTx(tx, { ...args, invoiceId: invoice.invoiceId })) {
      return { status: 'skipped', invoiceId: invoice.invoiceId }
    }

    const planned = await planImport(tx, invoice, args)

    if (!planned.ok) {
      if (!args.dryRun) {
        await tx.unprocessedPayment.create({
          data: {
            organizationId: args.organizationId,
            studentId: planned.studentId ?? null,
            reason: planned.reason,
            // Счёт целиком: разбирать будут по нему, и там видно и плательщика с
            // телефоном, и позиции.
            rawData: invoice as unknown as Prisma.InputJsonValue,
          },
        })
      }

      return { status: 'unprocessed', invoiceId: invoice.invoiceId, reason: planned.reason }
    }

    const { plan } = planned
    if (args.dryRun) {
      return { status: 'planned', invoiceId: invoice.invoiceId, plan }
    }

    // Счёт: деньги. `ACTIVE` — событие CRM называется «счёт оплачен», то есть
    // деньги уже получены, и пакеты выдаются тем же движением.
    const payment = await tx.payment.create({
      select: { id: true },
      data: {
        organizationId: args.organizationId,
        externalId: invoice.invoiceId,
        price: plan.price,
        date: plan.date,
        status: 'ACTIVE',
        // Способа оплаты в счёте нет, а завести «онлайн» с выдуманной комиссией
        // эквайринга нельзя: процент называет школа.
        paymentMethodId: null,
      },
    })

    let settled = 0
    for (const packet of plan.packages) {
      const created = await tx.package.create({
        select: { id: true },
        data: {
          organizationId: args.organizationId,
          studentId: plan.studentId,
          walletId: plan.walletId,
          paymentId: payment.id,
          // Продавца нет: продажу оформила CRM, а премия причитается человеку.
          managerId: null,
          lessonCount: packet.lessonCount,
          remaining: packet.lessonCount,
          price: packet.price,
          unitPrice: unitPriceOf(packet),
          date: plan.date,
          productId: packet.productId,
          productName: packet.productName,
        },
      })

      settled += await activatePackageTx(tx, {
        packageId: created.id,
        organizationId: args.organizationId,
        // Автора нет: оплату завела не рука, а опрос CRM.
        actorUserId: null,
        meta: { amocrmInvoiceId: invoice.invoiceId },
      })
    }

    return { status: 'imported', invoiceId: invoice.invoiceId, paymentId: payment.id, settled }
  }, IMPORT_TX_OPTIONS)
}
