import 'server-only'

import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from 'next-safe-action'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from './auth/server'
import { ActionError, ForbiddenError, UnauthorizedError } from './error'
import { type FeatureKey, isFeatureDisabled } from './features/registry'
import { DEFAULT_TZ } from './timezone'
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

    return error.message || DEFAULT_SERVER_ERROR_MESSAGE
  },
})

/**
 * Публичный action - без проверки auth.
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
    ctx: {
      session,
      // Часовой пояс организации; fallback на DEFAULT_TZ, если колонка пуста
      // или содержит невалидную зону. Пробрасывается во все server actions.
      tz: session.organization?.timezone ?? DEFAULT_TZ,
    },
  })
})

/**
 * Обёртка над `authAction`, требующая, чтобы фича была включена у организации.
 * Fail-closed: если фича (или её родитель) отключена — middleware бросит
 * `ForbiddenError` до выполнения экшена. Строй feature-scoped экшены только через
 * это (например `export const shopAction = featureAction('shop')`), чтобы серверный
 * гейт нельзя было забыть.
 *
 * @example
 * export const createOrder = featureAction('shop')
 *   .metadata({ actionName: 'createOrder' })
 *   .action(async ({ ctx }) => { ... })
 */
export function featureAction(feature: FeatureKey) {
  return authAction.use(async ({ next, ctx }) => {
    const disabled = (ctx.session.disabledFeatures as string[] | undefined) ?? []
    if (isFeatureDisabled(disabled, feature)) {
      throw new ForbiddenError('Функция отключена для организации')
    }
    return next()
  })
}
