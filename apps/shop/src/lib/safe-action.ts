import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from 'next-safe-action'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getStudentSession } from './auth/student-session'
import { ActionError } from './error'

const metadataSchema = z.object({
  actionName: z.string(),
})

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
 * Экшен от имени ученика. Fail-closed: нет сессии или школа недоступна —
 * `redirect('/login')`, middleware защитой не считается.
 *
 * `ctx.student.organizationId` обязан попадать в `where` КАЖДОГО запроса:
 * автоматической изоляции по организации в проекте нет.
 */
export const studentAction = baseClient.use(async ({ next }) => {
  const session = await getStudentSession(await headers())
  if (!session) {
    redirect('/login')
  }
  return next({ ctx: session })
})
