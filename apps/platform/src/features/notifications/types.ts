import { currentBotMessengerWhere } from '@repo/core/messenger'
import type { Prisma } from '@repo/db'

/**
 * Экран напоминаний для школы. До него фича работала вслепую: тумблер включён,
 * а кто подключён и что ушло — не видно нигде.
 *
 * Два списка отвечают на разные вопросы и потому не сведены в один: «Родители»
 * показывает состояние (кто подключён, кого дожимать), «Журнал» — что случилось
 * с конкретной отправкой и почему она не дошла.
 */

/**
 * Привязки в списке родителей — только к боту, которым школа рассылает сейчас:
 * по остальным напоминаний нет, и «подключён» по ним было бы неправдой.
 */
export function reminderParentSelect(hasOwnBot: boolean) {
  return {
    id: true,
    firstName: true,
    lastName: true,
    phone: true,
    students: { select: { student: { select: { id: true, firstName: true, lastName: true } } } },
    messengers: {
      where: currentBotMessengerWhere(hasOwnBot),
      select: { createdAt: true, unsubscribedAt: true },
    },
  } satisfies Prisma.ParentSelect
}

export type ReminderParentItem = Prisma.ParentGetPayload<{
  select: ReturnType<typeof reminderParentSelect>
}>
export type ReminderParentResult = { rows: ReminderParentItem[]; total: number }

export const REMINDER_LOG_SELECT = {
  id: true,
  text: true,
  status: true,
  attempts: true,
  lastError: true,
  sentAt: true,
  createdAt: true,
  nextAttemptAt: true,
  parentMessenger: {
    select: {
      parent: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.NotificationOutboxSelect

export type ReminderLogItem = Prisma.NotificationOutboxGetPayload<{
  select: typeof REMINDER_LOG_SELECT
}>
export type ReminderLogResult = { rows: ReminderLogItem[]; total: number }
