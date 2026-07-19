'use server'

import { Prisma } from '@/prisma/generated/client'
import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { ConflictError, UnauthorizedError } from '@/src/lib/error'
import { publicAction } from '@/src/lib/safe-action'
import { RESERVED_SLUGS, slugify } from '@/src/lib/utils'
import { APIError } from 'better-auth'
import { headers } from 'next/headers'
import z from 'zod'

/** better-auth отдаёт свои ошибки по-английски — переводим по коду. */
const ORG_ERROR_MESSAGES: Record<string, string> = {
  ORGANIZATION_ALREADY_EXISTS: 'Этот адрес уже занят — выберите другой.',
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS: 'У вас уже есть школа.',
}

const CreateSchoolSchema = z.object({
  name: z.string().trim().min(2, 'Введите название школы'),
  slug: z
    .string()
    .trim()
    .min(3, 'Минимум 3 символа: латиница, цифры и дефис')
    .refine((v) => slugify(v) === v, 'Только латиница, цифры и дефис')
    .refine((v) => !RESERVED_SLUGS.has(v), 'Этот адрес зарезервирован'),
  timezone: z.string().min(1),
})

/**
 * Создание первой школы из мастера онбординга.
 *
 * Намеренно `publicAction`, а не `authAction`: последний падает при
 * `!session.organizationId`, то есть непригоден ровно для того случая, ради
 * которого этот экшен и существует. Сессию проверяем руками.
 */
export const createSchool = publicAction
  .metadata({ actionName: 'createSchool' })
  .inputSchema(CreateSchoolSchema)
  .action(async ({ parsedInput }) => {
    const requestHeaders = await headers()
    const session = await auth.api.getSession({ headers: requestHeaders })
    if (!session) throw new UnauthorizedError()

    const { name, slug, timezone } = parsedInput

    try {
      // Заводит Organization + Member с ролью owner и проставляет
      // activeOrganizationId в текущей сессии.
      const organization = await auth.api.createOrganization({
        headers: requestHeaders,
        body: { name, slug },
      })
      if (!organization) throw new ConflictError('Не удалось создать школу')

      // ponytail: `createOrganization` — вызов better-auth, поэтому в одну
      // транзакцию с апдейтом его не завернуть. При падении здесь школа
      // останется с DEFAULT_TZ — правится в настройках организации.
      // `timezone` — не поле better-auth, дописываем следом.
      await prisma.organization.update({
        where: { id: Number(organization.id) },
        data: { timezone },
      })

      // TaxConfig не создаём: единственный доступный режим (USN_INCOME) — он же
      // DEFAULT_TAX_SYSTEM, а `getTaxConfig` заводит эту строку лениво.

      return { slug }
    } catch (error) {
      // Единственная реальная защита от гонки между checkSlug и созданием —
      // unique-индекс по slug; checkSlug остаётся подсказкой для UI.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Этот адрес уже занят — выберите другой.')
      }
      if (error instanceof APIError) {
        const code = (error.body as { code?: string } | undefined)?.code ?? ''
        throw new ConflictError(
          ORG_ERROR_MESSAGES[code] ?? 'Не удалось создать школу. Попробуйте ещё раз.',
        )
      }
      throw error
    }
  })
