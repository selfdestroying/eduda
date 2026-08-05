import { createSafeActionClient } from 'next-safe-action'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getStudentSession, loginRedirect } from './auth/student-session'
import { ActionError, ForbiddenError } from './error'

const metadataSchema = z.object({
  actionName: z.string(),
})

const baseClient = createSafeActionClient({
  defineMetadataSchema: () => metadataSchema,
  /**
   * Наружу уходит только то, что мы сами написали для ученика: `ActionError` —
   * это и есть «сообщение, которое можно показать». Всё остальное (текст Prisma,
   * крипто-ошибка, битый запрос) схлопывается в общее — иначе внутренности
   * приложения утекают в кабинет. В лог пишем целиком: диагностика нужна,
   * но на сервере.
   */
  handleServerError(error, { metadata }) {
    if (error instanceof ActionError) {
      return error.message
    }
    console.error(`[${metadata?.actionName ?? 'action'}]`, error)
    // Своё, а не DEFAULT_SERVER_ERROR_MESSAGE: тот по-английски, а кабинет русский.
    return 'Что-то пошло не так. Попробуйте ещё раз.'
  },
})

/**
 * Экшен от имени ученика. Fail-closed: нет сессии или школа недоступна —
 * `redirect('/login')`, middleware защитой не считается.
 *
 * `ctx.student.organizationId` обязан попадать в `where` КАЖДОГО запроса:
 * автоматической изоляции по организации в проекте нет.
 */
export const studentAction = baseClient.use(async ({ next }) => {
  const reqHeaders = await headers()
  const session = await getStudentSession(reqHeaders)
  if (!session) {
    redirect(await loginRedirect(reqHeaders))
  }
  return next({ ctx: session })
})

/**
 * Магазинный экшен. Гейт фичи продублирован здесь, чтобы его нельзя было забыть:
 * страница может отдать 404 сама, но `addToCart`, вызванный мимо неё, обязан
 * упереться в тот же запрет (§11.6).
 */
export const shopAction = studentAction.use(async ({ next, ctx }) => {
  if (ctx.disabledShop) {
    throw new ForbiddenError('Магазин отключён школой')
  }
  return next()
})
