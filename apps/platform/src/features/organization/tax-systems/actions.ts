'use server'

import type { Prisma } from '@/prisma/generated/client'
import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { DEFAULT_TAX_SYSTEM, TAX_SYSTEM_CONFIG_SCHEMAS, UpsertTaxConfigSchema } from './schemas'

export const getTaxConfig = authAction
  .metadata({ actionName: 'getTaxConfig' })
  .action(async ({ ctx }) => {
    const organizationId = ctx.session.organizationId!
    const existing = await prisma.taxConfig.findUnique({
      where: { organizationId },
    })
    if (existing) return existing

    const defaultConfig = TAX_SYSTEM_CONFIG_SCHEMAS[DEFAULT_TAX_SYSTEM].parse({})
    return await prisma.taxConfig.create({
      data: {
        taxSystem: DEFAULT_TAX_SYSTEM,
        config: defaultConfig as Prisma.InputJsonValue,
        organizationId,
      },
    })
  })

export const upsertTaxConfig = authAction
  .metadata({ actionName: 'upsertTaxConfig' })
  .inputSchema(UpsertTaxConfigSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { taxSystem, config } = parsedInput
    const jsonConfig = config as Prisma.InputJsonValue
    await prisma.taxConfig.upsert({
      where: { organizationId: ctx.session.organizationId! },
      create: {
        taxSystem,
        config: jsonConfig,
        organizationId: ctx.session.organizationId!,
      },
      update: {
        taxSystem,
        config: jsonConfig,
      },
    })
  })
