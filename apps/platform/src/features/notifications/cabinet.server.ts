import { isOrgFeatureDisabled } from '@repo/core/features-db'
import type { Prisma } from '@repo/db'
import { NotFoundError } from '@/src/lib/error'

/**
 * Что кабинет родителя делает с привязками мессенджеров. Сами боты живут в
 * `apps/bots` и пишут в те же таблицы — платформа здесь только показывает
 * состояние и гасит канал по кнопке.
 *
 * Без `server-only` и с клиентом первым параметром — как денежное ядро: так это
 * зовёт и экшен, и проверочный скрипт. Экшены импортировать из скрипта нельзя,
 * `safe-action.ts` тянет `server-only`.
 *
 * Сессии у родителя нет: граница доступа — `Parent.accessToken` из адреса,
 * ровно как во всём остальном кабинете.
 */

export type CabinetMessengers = {
  vk: boolean
  max: boolean
  /** Без номера в базе привязка по телефону невозможна — кнопку MAX не показываем. */
  hasPhone: boolean
}

async function parentByToken(db: Prisma.TransactionClient, token: string) {
  const parent = await db.parent.findUnique({
    where: { accessToken: token },
    select: { id: true, phone: true, organizationId: true },
  })
  if (!parent) throw new NotFoundError('Ссылка недействительна.')
  return parent
}

/** `null` — школа выключила напоминания: раздела в кабинете нет вовсе. */
export async function readCabinetMessengers(
  db: Prisma.TransactionClient,
  token: string,
): Promise<CabinetMessengers | null> {
  const parent = await parentByToken(db, token)

  if (await isOrgFeatureDisabled(db, parent.organizationId, 'notifications')) return null

  const messengers = await db.parentMessenger.findMany({
    where: { parentId: parent.id, unsubscribedAt: null },
    select: { provider: true },
  })

  return {
    vk: messengers.some((row) => row.provider === 'VK'),
    max: messengers.some((row) => row.provider === 'MAX'),
    hasPhone: Boolean(parent.phone),
  }
}

/**
 * Гасит канал, а не удаляет строку: она — единственный ответ на вопрос «почему
 * мне перестало приходить». Тем же способом отписывают сами боты.
 */
export async function disconnectCabinetMessenger(
  db: Prisma.TransactionClient,
  token: string,
  provider: 'VK' | 'MAX',
): Promise<number> {
  const parent = await parentByToken(db, token)

  const { count } = await db.parentMessenger.updateMany({
    where: { parentId: parent.id, provider, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  })

  return count
}
