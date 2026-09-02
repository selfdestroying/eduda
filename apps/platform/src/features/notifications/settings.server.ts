import type { Prisma } from '@repo/db'
import type { ReminderSettingsSchemaType } from './schemas'

/**
 * Настройки напоминаний школы. Читает и пишет их платформа, а применяет
 * планировщик в `apps/bots` — поэтому здесь только три поля и никакой логики
 * рассылки.
 *
 * Клиент первым параметром — как у остальных ядер: так это зовёт и экшен, и
 * проверочный скрипт.
 */

const settingsSelect = {
  remindersEnabled: true,
  reminderTime: true,
  reminderLeadDays: true,
} satisfies Prisma.OrganizationSelect

export async function readReminderSettings(
  db: Prisma.TransactionClient,
  organizationId: number,
): Promise<ReminderSettingsSchemaType> {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: settingsSelect,
  })

  return {
    remindersEnabled: org.remindersEnabled,
    reminderTime: org.reminderTime,
    // В базе колонка `Int`: сузить до 0|1 может только чтение, схема на входе
    // это уже гарантирует, а старое значение из базы — нет.
    reminderLeadDays: org.reminderLeadDays === 0 ? 0 : 1,
  }
}

export async function writeReminderSettings(
  db: Prisma.TransactionClient,
  organizationId: number,
  settings: ReminderSettingsSchemaType,
): Promise<ReminderSettingsSchemaType> {
  const org = await db.organization.update({
    where: { id: organizationId },
    data: settings,
    select: settingsSelect,
  })

  return {
    remindersEnabled: org.remindersEnabled,
    reminderTime: org.reminderTime,
    reminderLeadDays: org.reminderLeadDays === 0 ? 0 : 1,
  }
}
