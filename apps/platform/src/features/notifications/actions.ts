'use server'

import { prisma } from '@repo/db'
import { ForbiddenError } from '@/src/lib/error'
import { authAction, publicAction } from '@/src/lib/safe-action'
import { disconnectCabinetMessenger, readCabinetMessengers } from './cabinet.server'
import { readReminderSettings, writeReminderSettings } from './settings.server'
import {
  CabinetMessengersSchema,
  DisconnectMessengerSchema,
  ReminderSettingsSchema,
} from './schemas'

/**
 * Тонкие обёртки над ядрами: вся логика и её проверка — в `cabinet.server.ts`
 * (кабинет родителя) и `settings.server.ts` (настройки школы). Экшен из
 * проверочного скрипта не импортировать — `safe-action.ts` тянет `server-only`.
 */

export const getCabinetMessengers = publicAction
  .metadata({ actionName: 'getCabinetMessengers' })
  .inputSchema(CabinetMessengersSchema)
  .action(async ({ parsedInput }) => readCabinetMessengers(prisma, parsedInput.token))

export const disconnectMessenger = publicAction
  .metadata({ actionName: 'disconnectMessenger' })
  .inputSchema(DisconnectMessengerSchema)
  .action(async ({ parsedInput }) => ({
    disconnected: await disconnectCabinetMessenger(prisma, parsedInput.token, parsedInput.provider),
  }))

// ─── Настройки школы ────────────────────────────────────────────────

/**
 * Рассылка идёт от имени школы, поэтому её включение — решение владельца или
 * управляющего. Преподаватель настройки не видит и менять не может.
 */
function assertCanManage(memberRole: string | null | undefined) {
  if (memberRole !== 'owner' && memberRole !== 'manager') {
    throw new ForbiddenError('Настраивать напоминания может владелец или управляющий.')
  }
}

export const getReminderSettings = authAction
  .metadata({ actionName: 'getReminderSettings' })
  .action(async ({ ctx }) => {
    assertCanManage(ctx.session.memberRole)
    return readReminderSettings(prisma, ctx.session.organizationId!)
  })

export const updateReminderSettings = authAction
  .metadata({ actionName: 'updateReminderSettings' })
  .inputSchema(ReminderSettingsSchema)
  .action(async ({ ctx, parsedInput }) => {
    assertCanManage(ctx.session.memberRole)
    return writeReminderSettings(prisma, ctx.session.organizationId!, parsedInput)
  })
