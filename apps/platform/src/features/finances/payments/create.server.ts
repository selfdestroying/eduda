/**
 * Продажа: счёт и пакет заводятся парой.
 *
 * Одно место, где решается «деньги получены → уроки выданы», и три вызова —
 * менеджер в форме, разбор неразобранной оплаты, опрос amoCRM. До этого каждый
 * собирал пару сам, и проверки кошелька с чтением названия продукта стояли в
 * трёх экземплярах: разъехаться им было нечего стоить.
 *
 * Живёт отдельным `*.server.ts` по той же причине, что и `products/resolve.server.ts`:
 * файл с `'use server'` может экспортировать только сами экшены, а эту функцию
 * зовёт ещё и опрос CRM, у которого сессии нет вовсе.
 */
import { activatePackageTx, unitPriceOf } from '@/src/features/finances/ledger.server'
import { loadPackageProductTx } from '@/src/features/finances/products/resolve.server'
import { ConflictError, NotFoundError } from '@/src/lib/error'
import type { Prisma } from '@repo/db'

/**
 * Оплата закрывает занятия, которые её ждали, а каждое — отдельное списание со
 * своим пакетом, журналом и историей. У ученика, который долго ходил без оплаты,
 * таких десятки, и в дефолтные пять секунд Prisma длинный хвост не укладывается:
 * транзакция откатится целиком, и оплата не пройдёт вовсе.
 */
export const PAYMENT_TX_OPTIONS = { timeout: 30_000 }

export type CreatePaymentArgs = {
  organizationId: number
  studentId: number
  walletId: number
  productId: number
  lessonCount: number
  /** Сколько заплатили за этот пакет. Цена урока выводится отсюда. */
  price: number
  /** Бизнес-день: по нему пакет встаёт в очередь кошелька. */
  date: string
  paymentMethodId?: number | null
  /** Кто продал. У оплаты из CRM продавца нет. */
  managerId?: number | null
  /** Id счёта во внешней системе. Ключ идемпотентности для опроса amoCRM. */
  externalId?: number | null
  /**
   * Деньги уже в руках. Нет — счёт остаётся `PENDING`, пакет уроков не выдаёт и в
   * очередь не встаёт до подтверждения.
   */
  received: boolean
  actorUserId: number | null
  /** Дополнительные поля в историю выдачи. */
  meta?: Record<string, unknown>
}

export type CreatePaymentResult = {
  paymentId: number
  packageId: number
  /** Сколько ждавших оплаты занятий закрылось этим пакетом. */
  settled: number
}

/**
 * Завести счёт с пакетом и, если деньги получены, выдать уроки.
 *
 * Кошелёк проверяется здесь, а не у каждого вызывающего: `walletId` приходит из
 * запроса, и без проверки чужой id нашёлся бы, а пакет лёг бы в чужую школу —
 * `organizationId` для него брался бы из самого кошелька.
 *
 * Название продукта тоже читается здесь, из базы: снимок на момент продажи обязан
 * быть настоящим, а не тем, что прислал клиент.
 */
export async function createPaymentWithPackageTx(
  tx: Prisma.TransactionClient,
  args: CreatePaymentArgs,
): Promise<CreatePaymentResult> {
  const product = await loadPackageProductTx(tx, args.productId, args.organizationId)

  const wallet = await tx.wallet.findFirst({
    where: { id: args.walletId, organizationId: args.organizationId },
    select: { studentId: true, status: true },
  })
  if (!wallet) throw new NotFoundError('Кошелёк не найден')
  if (wallet.studentId !== args.studentId)
    throw new ConflictError('Кошелёк не принадлежит этому ученику')
  // Архивный кошелёк из интерфейса не выбрать, но запросом — можно.
  if (wallet.status !== 'ACTIVE') throw new ConflictError('Кошелёк архивирован')

  // Счёт: деньги. Уроков он не знает — они на пакете.
  const payment = await tx.payment.create({
    select: { id: true },
    data: {
      organizationId: args.organizationId,
      price: args.price,
      date: args.date,
      status: args.received ? 'ACTIVE' : 'PENDING',
      paymentMethodId: args.paymentMethodId ?? null,
      externalId: args.externalId ?? null,
    },
  })

  // Пакет: уроки. Пока счёт не подтверждён, лежит `PENDING` — в очередь не встаёт
  // и баланса не двигает.
  const packet = await tx.package.create({
    select: { id: true },
    data: {
      organizationId: args.organizationId,
      studentId: args.studentId,
      walletId: args.walletId,
      paymentId: payment.id,
      managerId: args.managerId ?? null,
      lessonCount: args.lessonCount,
      remaining: args.lessonCount,
      price: args.price,
      unitPrice: unitPriceOf(args),
      date: args.date,
      productId: product.id,
      // Снимок названия: продукт потом переименуют или удалят, а подпись этого
      // пакета обязана остаться прежней.
      productName: product.name,
    },
  })

  // Деньги уже в руках — выдаём уроки тем же движением: для администратора с
  // наличными создание и подтверждение это один шаг.
  const settled = args.received
    ? await activatePackageTx(tx, {
        packageId: packet.id,
        organizationId: args.organizationId,
        actorUserId: args.actorUserId,
        meta: args.meta,
      })
    : 0

  return { paymentId: payment.id, packageId: packet.id, settled }
}
