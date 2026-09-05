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

export type Command = 'stop' | 'resume' | 'cabinet'

/**
 * Команды бота. Слова помимо самих команд — потому что меню не всегда под
 * рукой: «стоп» и «кабинет» человек всё равно наберёт словами.
 *
 * Всё, чего здесь нет, командой не считается и остаётся без ответа: бот,
 * отвечающий «не понял» на каждую реплику, учит только тому, что ему не пишут.
 */
const COMMANDS: Record<string, Command> = {
  '/stop': 'stop',
  stop: 'stop',
  стоп: 'stop',
  отписаться: 'stop',
  отписка: 'stop',

  '/resume': 'resume',
  resume: 'resume',
  подписаться: 'resume',
  включить: 'resume',

  '/cabinet': 'cabinet',
  cabinet: 'cabinet',
  кабинет: 'cabinet',
}

export function readCommand(text: string): Command | null {
  return COMMANDS[text.trim().toLowerCase()] ?? null
}

/** Привязка глазами бота: кому она принадлежит и включена ли сейчас. */
export type Binding = {
  parentId: number
  firstName: string
  accessToken: string
  organization: string
  active: boolean
}

/**
 * Все привязки аккаунта, включая отписанные: по ним бот отличает «отключил
 * напоминания» от «здесь вообще никого нет» — ответы у этих двух состояний
 * разные, и второму нужна кнопка, а не текст.
 */
export async function readBindings(
  db: Prisma.TransactionClient,
  provider: MessengerProvider,
  externalId: string,
): Promise<Binding[]> {
  const rows = await db.parentMessenger.findMany({
    where: { provider, externalId },
    select: {
      unsubscribedAt: true,
      parent: {
        select: {
          id: true,
          firstName: true,
          accessToken: true,
          organization: { select: { name: true } },
        },
      },
    },
  })

  return rows.map((row) => ({
    parentId: row.parent.id,
    firstName: row.parent.firstName,
    accessToken: row.parent.accessToken,
    organization: row.parent.organization.name,
    active: row.unsubscribedAt === null,
  }))
}
