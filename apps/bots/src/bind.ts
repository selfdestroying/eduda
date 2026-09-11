import type { Prisma } from '@repo/db'
import type { BotScope } from './bots'
import { normalizePhone } from './phone'

/**
 * Всё, что привязка родителя делает с базой. Отдельно от роутов не ради слоёв,
 * а потому что это же зовёт проверочный скрипт: HTTP там не нужен, а поведение
 * проверить надо.
 *
 * Первым параметром идёт клиент — как у денежного ядра платформы. В проде это
 * обычный `prisma`, в проверке — транзакция, которая в конце откатывается.
 *
 * Вторым — область бота (`BotScope`): бот ЕДУДА и бот школы видят только свои
 * привязки, и `/stop` в одном не отписывает от другого.
 */

export type BoundParent = { parentId: number; firstName: string }

/** Отбор привязок бота: у бота школы — только к нему, у бота ЕДУДА — только к нему. */
function scopeWhere(scope: BotScope): Prisma.ParentMessengerWhereInput {
  return scope.ownBot
    ? { provider: 'MAX', ownBot: true, organizationId: scope.organizationId }
    : { provider: 'MAX', ownBot: false }
}

/**
 * Привязка по телефону. Номер приходит от самой платформы через
 * `request_contact`, то есть уже подтверждён ею; спрашивать код сверх этого
 * нечего и негде.
 *
 * Совпасть может несколько родителей: у человека бывают дети в разных школах —
 * это разные `Parent` с одним номером. Привязываем ко всем, кого бот видит,
 * иначе половина детей осталась бы без напоминаний.
 *
 * Кого бот видит:
 * - бот школы — только её родителей. Через него уходит рассказ о детях со
 *   ссылками на кабинеты, а токен бота у самой школы: ссылка на кабинет чужой
 *   школы, отправленная через него, — это доступ к чужим детям;
 * - бот ЕДУДА — родителей школ без включённого своего бота. Родителю школы,
 *   которая рассылает своим ботом, он пообещал бы напоминания, которые пойдут
 *   другим ботом. Выключенный бот школы не в счёт: она вернулась на ЕДУДА.
 *
 * `phone` ожидается уже нормализованным.
 */
export async function bindByPhone(
  db: Prisma.TransactionClient,
  scope: BotScope,
  externalId: string,
  phone: string,
): Promise<BoundParent[]> {
  // ponytail: скан всех родителей с непустым телефоном. Их около тысячи, а
  // привязка — разовое событие на родителя. Колонка `phoneDigits` с индексом —
  // когда счёт пойдёт на десятки тысяч.
  const candidates = await db.parent.findMany({
    where: {
      phone: { not: null },
      ...(scope.ownBot
        ? { organizationId: scope.organizationId }
        : { organization: { NOT: { maxBot: { is: { enabled: true } } } } }),
    },
    select: { id: true, firstName: true, phone: true, organizationId: true },
  })

  const matched = candidates.filter((parent) => normalizePhone(parent.phone!) === phone)

  for (const parent of matched) {
    await db.parentMessenger.upsert({
      where: {
        provider_externalId_parentId_ownBot: {
          provider: 'MAX',
          externalId,
          parentId: parent.id,
          ownBot: scope.ownBot,
        },
      },
      create: {
        provider: 'MAX',
        externalId,
        phone,
        ownBot: scope.ownBot,
        parentId: parent.id,
        organizationId: parent.organizationId,
      },
      update: { unsubscribedAt: null, phone },
    })
  }

  return matched.map((parent) => ({ parentId: parent.id, firstName: parent.firstName }))
}

/**
 * Школы со своим ботом, у которых этот номер записан в карточке родителя.
 *
 * Бот ЕДУДА таких родителей не привязывает (см. `bindByPhone`), но ответить им
 * «никого не нашёл» нельзя: номер верный, и школа впустую проверяла бы карточку,
 * а родитель так и не узнал бы, что писать надо боту школы. Ему нужна ссылка.
 */
export async function schoolBotsForPhone(
  db: Prisma.TransactionClient,
  phone: string,
): Promise<Array<{ organization: string; username: string }>> {
  const candidates = await db.parent.findMany({
    where: { phone: { not: null }, organization: { maxBot: { is: { enabled: true } } } },
    select: {
      phone: true,
      organization: { select: { name: true, maxBot: { select: { username: true } } } },
    },
  })

  const bots = new Map<string, { organization: string; username: string }>()
  for (const candidate of candidates) {
    const username = candidate.organization.maxBot?.username
    if (username && normalizePhone(candidate.phone!) === phone) {
      bots.set(username, { organization: candidate.organization.name, username })
    }
  }
  return [...bots.values()]
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
  scope: BotScope,
  externalId: string,
): Promise<number> {
  const { count } = await db.parentMessenger.updateMany({
    where: { ...scopeWhere(scope), externalId, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  })
  return count
}

/**
 * Возврат подписки: `/resume` или кнопка «Вернуть» под напоминанием. Трогает
 * только погашенные привязки, и число возвращённых боту нужно: ноль — это
 * «напоминания и так приходят», а не «вернул».
 */
export async function resubscribeAll(
  db: Prisma.TransactionClient,
  scope: BotScope,
  externalId: string,
): Promise<number> {
  const { count } = await db.parentMessenger.updateMany({
    where: { ...scopeWhere(scope), externalId, unsubscribedAt: { not: null } },
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
 * Все привязки аккаунта к этому боту, включая отписанные: по ним бот отличает
 * «отключил напоминания» от «здесь вообще никого нет» — ответы у этих двух
 * состояний разные, и второму нужна кнопка, а не текст.
 */
export async function readBindings(
  db: Prisma.TransactionClient,
  scope: BotScope,
  externalId: string,
): Promise<Binding[]> {
  const rows = await db.parentMessenger.findMany({
    where: { ...scopeWhere(scope), externalId },
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
