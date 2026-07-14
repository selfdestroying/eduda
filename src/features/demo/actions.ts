'use server'

import { ForbiddenError } from '@/src/lib/error'
import { authAction, publicAction } from '@/src/lib/safe-action'
import { protocol, rootDomain } from '@/src/lib/utils'
import { auth } from '@/src/lib/auth/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { isDemoOrg } from './constants'
import { DEMO_SLUG, DEMO_USERS, demoPassword, type DemoRole } from './constants'

const RoleSchema = z.object({
  role: z.enum(['owner', 'manager', 'teacher']).default('owner'),
})

const demoUrl = `${protocol}://${DEMO_SLUG}.${rootDomain}/`

/** Логинит текущего посетителя под demo-пользователем указанной роли. */
async function signInAsDemo(role: DemoRole) {
  await auth.api.signInEmail({
    body: { email: DEMO_USERS[role].email, password: demoPassword(role) },
    headers: await headers(),
  })
}

/**
 * Вход в демо «с улицы». Публичный: логинит под demo-пользователем выбранной
 * роли (по умолчанию — владелец) и возвращает URL демо-поддомена для перехода.
 */
export const startDemo = publicAction
  .metadata({ actionName: 'startDemo' })
  .inputSchema(RoleSchema)
  .action(async ({ parsedInput }) => {
    if (process.env.DEMO_ENABLED === 'false') {
      throw new ForbiddenError('Демо-режим отключён')
    }
    await signInAsDemo(parsedInput.role)
    return { url: demoUrl }
  })

/**
 * Переключение роли внутри демо. Доступно только когда текущая организация —
 * демо (`metadata.demo`). Перелогинивает под demo-пользователем нужной роли.
 */
export const switchDemoRole = authAction
  .metadata({ actionName: 'switchDemoRole' })
  .inputSchema(RoleSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!isDemoOrg(ctx.session.organization)) {
      throw new ForbiddenError('Доступно только в демо-режиме')
    }
    await signInAsDemo(parsedInput.role)
    return { url: demoUrl }
  })
