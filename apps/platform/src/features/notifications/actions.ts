'use server'

import { prisma } from '@repo/db'
import { ForbiddenError } from '@/src/lib/error'
import { authAction, publicAction } from '@/src/lib/safe-action'
import { connectMaxBot, readMaxBot, setMaxBotEnabled, testMaxBotToken } from './bot.server'
import { disconnectCabinetMessenger, readCabinetMessengers } from './cabinet.server'
import { readReminderLog, readReminderParents } from './overview.server'
import { readReminderSettings, writeReminderSettings } from './settings.server'
import {
  CabinetMessengersSchema,
  DisconnectMessengerSchema,
  MaxBotEnabledSchema,
  MaxBotTokenSchema,
  ReminderLogListSchema,
  ReminderParentListSchema,
  ReminderSettingsSchema,
} from './schemas'

/**
 * Тонкие обёртки над ядрами: вся логика и её проверка — в `cabinet.server.ts`
 * (кабинет родителя), `settings.server.ts` (настройки школы) и `bot.server.ts`
 * (свой бот школы). Экшен из проверочного скрипта не импортировать —
 * `safe-action.ts` тянет `server-only`.
 */

export const getCabinetMessengers = publicAction
  .metadata({ actionName: 'getCabinetMessengers' })
  .inputSchema(CabinetMessengersSchema)
  .action(async ({ parsedInput }) => readCabinetMessengers(prisma, parsedInput.token))

export const disconnectMessenger = publicAction
  .metadata({ actionName: 'disconnectMessenger' })
  .inputSchema(DisconnectMessengerSchema)
  .action(async ({ parsedInput }) => ({
    disconnected: await disconnectCabinetMessenger(prisma, parsedInput.token),
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

/**
 * Свой бот школы — только владельцу: токен даёт полное управление ботом, и от
 * его имени школа говорит с родителями. Управляющий видит, какой бот работает,
 * но выбрать или подключить его не может.
 */
function assertOwner(memberRole: string | null | undefined) {
  if (memberRole !== 'owner') {
    throw new ForbiddenError('Выбирать и подключать бота школы может только владелец.')
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

export const getMaxBot = authAction
  .metadata({ actionName: 'getMaxBot' })
  .action(async ({ ctx }) => {
    assertCanManage(ctx.session.memberRole)
    return readMaxBot(prisma, ctx.session.organizationId!)
  })

export const testSchoolMaxBot = authAction
  .metadata({ actionName: 'testSchoolMaxBot' })
  .inputSchema(MaxBotTokenSchema)
  .action(async ({ ctx, parsedInput }) => {
    assertOwner(ctx.session.memberRole)
    return testMaxBotToken(prisma, ctx.session.organizationId!, parsedInput.token)
  })

export const connectSchoolMaxBot = authAction
  .metadata({ actionName: 'connectSchoolMaxBot' })
  .inputSchema(MaxBotTokenSchema)
  .action(async ({ ctx, parsedInput }) => {
    assertOwner(ctx.session.memberRole)
    return connectMaxBot(prisma, ctx.session.organizationId!, parsedInput.token)
  })

export const setSchoolMaxBotEnabled = authAction
  .metadata({ actionName: 'setSchoolMaxBotEnabled' })
  .inputSchema(MaxBotEnabledSchema)
  .action(async ({ ctx, parsedInput }) => {
    assertOwner(ctx.session.memberRole)
    return setMaxBotEnabled(prisma, ctx.session.organizationId!, parsedInput.enabled)
  })

// ─── Экран школы ────────────────────────────────────────────────────

/**
 * Строки и `count` идут одной транзакцией: иначе «Страница 3 из 5»
 * разъезжается с тем, что реально вернулось.
 */

export const getReminderParents = authAction
  .metadata({ actionName: 'getReminderParents' })
  .inputSchema(ReminderParentListSchema)
  .action(async ({ ctx, parsedInput }) => {
    assertCanManage(ctx.session.memberRole)
    return prisma.$transaction((tx) =>
      readReminderParents(tx, ctx.session.organizationId!, parsedInput),
    )
  })

export const getReminderLog = authAction
  .metadata({ actionName: 'getReminderLog' })
  .inputSchema(ReminderLogListSchema)
  .action(async ({ ctx, parsedInput }) => {
    assertCanManage(ctx.session.memberRole)
    return prisma.$transaction((tx) =>
      readReminderLog(tx, ctx.session.organizationId!, ctx.tz, parsedInput),
    )
  })
