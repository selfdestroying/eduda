import type { Prisma } from '@repo/db'
import {
  DEFAULT_LEAD_MINUTES,
  REMINDER_LEAD_OPTIONS,
  type ReminderSettingsSchemaType,
} from './schemas'

/**
 * Настройки напоминаний школы. Читает и пишет их платформа, а применяет
 * планировщик в `apps/bots` — поэтому здесь только четыре поля и никакой логики
 * рассылки.
 *
 * Клиент первым параметром — как у остальных ядер: так это зовёт и экшен, и
 * проверочный скрипт.
 */

const settingsSelect = {
  remindersEnabled: true,
  reminderMode: true,
  reminderTime: true,
  reminderLeadMinutes: true,
  reminderTemplate: true,
  reminderLineTemplate: true,
} satisfies Prisma.OrganizationSelect

type Row = Prisma.OrganizationGetPayload<{ select: typeof settingsSelect }>

/**
 * Колонка в базе `Int`, а форма и планировщик знают закрытый список. Сузить
 * может только чтение: схема на входе это уже гарантирует, а значение, лежащее
 * в базе с прошлых времён или от чужого клиента, — нет.
 */
function toSettings(org: Row): ReminderSettingsSchemaType {
  const known = REMINDER_LEAD_OPTIONS.find((o) => o.minutes === org.reminderLeadMinutes)

  return {
    remindersEnabled: org.remindersEnabled,
    reminderMode: org.reminderMode,
    reminderTime: org.reminderTime,
    reminderLeadMinutes: known?.minutes ?? DEFAULT_LEAD_MINUTES,
    // Шаблон не чиним при чтении, в отличие от запаса в минутах: сломанный
    // виден в форме как есть, вместе с причиной, и школа правит его сама.
    // Молчаливая подмена на дефолт стёрла бы её текст.
    reminderTemplate: org.reminderTemplate,
    reminderLineTemplate: org.reminderLineTemplate,
  }
}

export async function readReminderSettings(
  db: Prisma.TransactionClient,
  organizationId: number,
): Promise<ReminderSettingsSchemaType> {
  return toSettings(
    await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: settingsSelect,
    }),
  )
}

export async function writeReminderSettings(
  db: Prisma.TransactionClient,
  organizationId: number,
  settings: ReminderSettingsSchemaType,
): Promise<ReminderSettingsSchemaType> {
  return toSettings(
    await db.organization.update({
      where: { id: organizationId },
      // Пишутся оба поля, включая то, что в выбранном режиме не работает:
      // школа переключает режим туда-сюда, и терять настройку соседнего при
      // каждом переключении незачем.
      data: settings,
      select: settingsSelect,
    }),
  )
}
