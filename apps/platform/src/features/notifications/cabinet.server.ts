import { isOrgFeatureDisabled } from '@repo/core/features-db'
import { activeMessengerWhere } from '@repo/core/messenger'
import type { Prisma } from '@repo/db'
import { NotFoundError } from '@/src/lib/error'

/**
 * Что кабинет родителя делает с привязками мессенджера. Сам бот живёт в
 * `apps/bots` и пишет в те же таблицы — платформа здесь только показывает
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
  /** Подключён к боту, которым школа рассылает сейчас. */
  max: boolean
  /** Без номера в базе привязка по телефону невозможна — кнопку MAX не показываем. */
  hasPhone: boolean
  /** Свой бот школы — к нему и ведёт кнопка подключения; `null` — бот ЕДУДА. */
  botUsername: string | null
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

  const bot = await db.organizationMaxBot.findUnique({
    where: { organizationId: parent.organizationId },
    select: { username: true, enabled: true },
  })
  // Подключение к боту ЕДУДА у школы, которая рассылает своим ботом,
  // «подключено» не считается: напоминаний по нему нет, и кнопка должна вести к
  // боту школы. Выключенный бот школы не в счёт — она вернулась на ЕДУДА.
  const ownBot = bot?.enabled ? bot : null
  const connected = await db.parentMessenger.count({
    where: { parentId: parent.id, ...activeMessengerWhere(ownBot !== null) },
  })

  return {
    max: connected > 0,
    hasPhone: Boolean(parent.phone),
    botUsername: ownBot?.username ?? null,
  }
}

/**
 * Гасит канал, а не удаляет строку: она — единственный ответ на вопрос «почему
 * мне перестало приходить». Тем же способом отписывают сами боты.
 *
 * Все привязки родителя разом, к любому боту: «отключить» в кабинете значит
 * «не пишите мне».
 */
export async function disconnectCabinetMessenger(
  db: Prisma.TransactionClient,
  token: string,
): Promise<number> {
  const parent = await parentByToken(db, token)

  const { count } = await db.parentMessenger.updateMany({
    where: { parentId: parent.id, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  })

  return count
}
