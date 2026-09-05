import type { Prisma } from '@repo/db'

/**
 * Экран напоминаний для школы. До него фича работала вслепую: тумблер включён,
 * а кто подключён и что ушло — не видно нигде.
 *
 * Два списка отвечают на разные вопросы и потому не сведены в один: «Родители»
 * показывает состояние (кто подключён, кого дожимать), «Журнал» — что случилось
 * с конкретной отправкой и почему она не дошла.
 */

export const REMINDER_PARENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  students: { select: { student: { select: { id: true, firstName: true, lastName: true } } } },
  messengers: { select: { id: true, provider: true, createdAt: true, unsubscribedAt: true } },
} satisfies Prisma.ParentSelect

export type ReminderParentItem = Prisma.ParentGetPayload<{ select: typeof REMINDER_PARENT_SELECT }>
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
      provider: true,
      parent: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.NotificationOutboxSelect

export type ReminderLogItem = Prisma.NotificationOutboxGetPayload<{
  select: typeof REMINDER_LOG_SELECT
}>
export type ReminderLogResult = { rows: ReminderLogItem[]; total: number }
