'use server'

import { prisma } from '@repo/db'
import { publicAction } from '@/src/lib/safe-action'
import { disconnectCabinetMessenger, readCabinetMessengers } from './cabinet.server'
import { CabinetMessengersSchema, DisconnectMessengerSchema } from './schemas'

/** Тонкие обёртки над ядром: вся логика и её проверка — в `cabinet.server.ts`. */

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
