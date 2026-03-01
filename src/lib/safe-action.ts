import 'server-only'

import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from 'next-safe-action'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from './auth/server'
import { ActionError, UnauthorizedError } from './error'
import { protocol, rootDomain } from './utils'

/** Схема метаданных для всех server actions */
const metadataSchema = z.object({
  actionName: z.string(),
})

/**
 * Базовый клиент для server actions.
 * Обрабатывает ошибки: ActionError → serverError, остальные → generic.
 */
const baseClient = createSafeActionClient({
  defineMetadataSchema: () => metadataSchema,
  handleServerError(error) {
    if (error instanceof ActionError) {
      return error.message
    }

    return DEFAULT_SERVER_ERROR_MESSAGE
  },
})

/**
 * Публичный action — без проверки auth.
 * Использовать только для действий, доступных без авторизации.
 */
export const publicAction = baseClient

/**
 * Action с обязательной аутентификацией.
 * ctx содержит полную сессию (user, session, organization, roles).
 */
export const authAction = baseClient.use(async ({ next }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }

  if (!session.organizationId) {
    throw new UnauthorizedError('Пользователь не привязан к организации')
  }

  if (!session.memberRole) {
    throw new UnauthorizedError('Не определена роль в организации')
  }

  return next({
    ctx: { session },
  })
})
