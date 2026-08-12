import { Prisma } from '@repo/db'

/**
 * Поля, которые рисует таблица оплат, — и ничего сверх них. `include: true` по
 * связям тянул в браузер все скаляры ученика, группы, курса и локации на каждую
 * строку; список за месяц из-за этого весил мегабайты.
 *
 * Кошелёк выбирается вложенно, но узко: ровно то, что нужно `getWalletLabel`,
 * чтобы свернуть его в одну строку ещё на сервере (см. `PaymentListItem`).
 */
export const PAYMENT_LIST_SELECT = {
  id: true,
  lessonCount: true,
  remaining: true,
  price: true,
  bidForLesson: true,
  date: true,
  status: true,
  cancelledAt: true,
  isAdjustment: true,
  student: { select: { id: true, firstName: true, lastName: true } },
  paymentMethod: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true } },
  wallet: {
    select: {
      id: true,
      name: true,
      studentGroups: {
        select: {
          status: true,
          group: {
            select: {
              name: true,
              course: { select: { name: true } },
              schedules: { select: { dayOfWeek: true, time: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PaymentSelect

type PaymentListRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_LIST_SELECT }>

/**
 * Строка таблицы: кошелёк уже свёрнут в подпись, каскада связей в браузере нет.
 * `walletLabel` — null у старых оплат, заведённых до кошельков.
 */
export type PaymentListItem = Omit<PaymentListRow, 'wallet'> & {
  walletId: number | null
  walletLabel: string | null
}

/** Ученик для выпадашки в форме оплаты: активные кошельки с готовыми подписями. */
export type StudentForPayment = {
  id: number
  firstName: string
  lastName: string | null
  wallets: Array<{ id: number; label: string }>
}
