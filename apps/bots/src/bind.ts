import type { Prisma } from '@repo/db'
import type { MessengerProvider } from '@repo/db/enums'
import { normalizePhone } from './phone'

/**
 * Всё, что привязка родителя делает с базой. Отдельно от роутов не ради слоёв,
 * а потому что это же зовёт проверочный скрипт: HTTP там не нужен, а поведение
 * проверить надо.
 *
 * Первым параметром идёт клиент — как у денежного ядра платформы. В проде это
 * обычный `prisma`, в проверке — транзакция, которая в конце откатывается.
 */

/**
 * `Parent.accessToken` — колонка типа `uuid`, и Postgres падает на любой строке,
 * которая на uuid не похожа. `ref` приходит из ссылки, то есть от кого угодно,
 * поэтому форму проверяем до запроса, а не отдаём драйверу.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type BoundParent = { parentId: number; firstName: string }

/**
 * Привязка по персональной ссылке `vk.me/…?ref=<Parent.accessToken>`.
 *
 * Отдельного секрета у привязки нет намеренно: этот же токен открывает
 * `/cabinet/{token}` со всеми данными ребёнка, так что владение ссылкой уже
 * равно доступу. Новый секрет добавил бы вторую дверь к той же комнате.
 *
 * `null` — токен не наш или испорчен; звать школу, а не гадать.
 */
export async function bindByRef(
  db: Prisma.TransactionClient,
  ref: string,
  externalId: string,
): Promise<BoundParent | null> {
  if (!UUID.test(ref)) return null

  const parent = await db.parent.findUnique({
    where: { accessToken: ref },
    select: { id: true, firstName: true, organizationId: true },
  })
  if (!parent) return null

  await db.parentMessenger.upsert({
    where: {
      provider_externalId_parentId: { provider: 'VK', externalId, parentId: parent.id },
    },
    create: {
      provider: 'VK',
      externalId,
      parentId: parent.id,
      organizationId: parent.organizationId,
    },
    // Повторный переход по ссылке — это «включите обратно», а не ошибка.
    update: { unsubscribedAt: null },
  })

  return { parentId: parent.id, firstName: parent.firstName }
}

/**
 * Привязка по телефону — путь MAX. Номер приходит от самой платформы через
 * `request_contact`, то есть уже подтверждён ею; спрашивать код сверх этого
 * нечего и негде.
 *
 * Совпасть может несколько родителей: бот один на всю установку, и у человека
 * бывают дети в разных школах — это разные `Parent` с одним номером.
 * Привязываем ко всем, иначе половина детей осталась бы без напоминаний.
 *
 * `phone` ожидается уже нормализованным.
 */
export async function bindByPhone(
  db: Prisma.TransactionClient,
  externalId: string,
  phone: string,
): Promise<BoundParent[]> {
  // ponytail: скан всех родителей с непустым телефоном. Их около тысячи, а
  // привязка — разовое событие на родителя. Колонка `phoneDigits` с индексом —
  // когда счёт пойдёт на десятки тысяч.
  const candidates = await db.parent.findMany({
    where: { phone: { not: null } },
    select: { id: true, firstName: true, phone: true, organizationId: true },
  })

  const matched = candidates.filter((parent) => normalizePhone(parent.phone!) === phone)

  for (const parent of matched) {
    await db.parentMessenger.upsert({
      where: {
        provider_externalId_parentId: { provider: 'MAX', externalId, parentId: parent.id },
      },
      create: {
        provider: 'MAX',
        externalId,
        phone,
        parentId: parent.id,
        organizationId: parent.organizationId,
      },
      update: { unsubscribedAt: null, phone },
    })
  }

  return matched.map((parent) => ({ parentId: parent.id, firstName: parent.firstName }))
}

/**
 * Отписка по аккаунту, а не по родителю: команду «стоп» пишет человек, и он
 * имеет в виду «мне», а не «этому ребёнку». У одного аккаунта бывает несколько
 * привязок — дети в разных школах.
 *
 * Строки остаются: удалить их значит потерять ответ на вопрос «а почему мне
 * перестало приходить».
 */
export async function unsubscribeAll(
  db: Prisma.TransactionClient,
  provider: MessengerProvider,
  externalId: string,
): Promise<number> {
  const { count } = await db.parentMessenger.updateMany({
    where: { provider, externalId, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  })
  return count
}

/**
 * VK присылает `message_allow`, когда родитель разрешил сообщения из настроек
 * сообщества, — это ровно противоположный `message_deny` сигнал, и обрабатывать
 * надо оба, иначе разрешение обратно ничего не включает.
 */
export async function resubscribeAll(
  db: Prisma.TransactionClient,
  provider: MessengerProvider,
  externalId: string,
): Promise<number> {
  const { count } = await db.parentMessenger.updateMany({
    where: { provider, externalId, unsubscribedAt: { not: null } },
    data: { unsubscribedAt: null },
  })
  return count
}

/** Команды отписки, которые родитель напишет своими словами. */
const STOP_WORDS = new Set(['/stop', 'stop', 'стоп', 'отписаться', 'отписка'])

export function isStopCommand(text: string): boolean {
  return STOP_WORDS.has(text.trim().toLowerCase())
}
