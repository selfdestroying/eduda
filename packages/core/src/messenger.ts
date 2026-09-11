import type { Prisma } from '@repo/db'

/**
 * Какие привязки родителей сейчас «работают» у школы. Единственное определение:
 * его читают планировщик в `apps/bots`, экран школы, кабинет родителя и
 * карточка ученика. Копия в каждом из них разошлась бы с остальными молча — и
 * школа видела бы подключённых родителей, до которых ничего не доходит.
 *
 * Рассылает школа в каждый момент одним ботом: ботом ЕДУДА или собственным.
 * Привязки другого бота остаются в базе, но напоминаний по ним нет, поэтому и
 * подключёнными они не считаются.
 */

/** Есть ли у школы собственный бот MAX. */
export async function hasOwnMaxBot(
  db: Prisma.TransactionClient,
  organizationId: number,
): Promise<boolean> {
  return (await db.organizationMaxBot.count({ where: { organizationId } })) > 0
}

/** Привязки к боту, которым школа рассылает сейчас, — и живые, и отписанные. */
export function currentBotMessengerWhere(hasOwnBot: boolean): Prisma.ParentMessengerWhereInput {
  return { provider: 'MAX', ownBot: hasOwnBot }
}

/** Живые привязки к этому боту: по ним и уходят напоминания. */
export function activeMessengerWhere(hasOwnBot: boolean): Prisma.ParentMessengerWhereInput {
  return { ...currentBotMessengerWhere(hasOwnBot), unsubscribedAt: null }
}
