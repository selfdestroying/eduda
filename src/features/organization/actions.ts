'use server'

import { Prisma } from '@/prisma/generated/client'
import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { ConflictError, UnauthorizedError } from '@/src/lib/error'
import { publicAction } from '@/src/lib/safe-action'
import { isValidTimeZone } from '@/src/lib/timezone'
import { RESERVED_SLUGS, slugify } from '@/src/lib/utils'
import { APIError } from 'better-auth'
import { headers } from 'next/headers'
import z from 'zod'
import { TAX_SYSTEM_CONFIG_SCHEMAS, type TaxSystemKey } from './tax-systems/schemas'

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
  // Экшен публичный, а список поясов живёт только в клиентском компоненте —
  // валидируем тем же `isValidTimeZone`, что и хелперы дат. Без этого мусорная
  // строка молча легла бы в колонку, а `safeTz` так же молча подменял бы её на
  // DEFAULT_TZ: школа работала бы по Москве, и никто бы не узнал.
  timezone: z.string().refine(isValidTimeZone, 'Неизвестный часовой пояс'),
  taxSystem: z.enum(
    Object.keys(TAX_SYSTEM_CONFIG_SCHEMAS) as [TaxSystemKey, ...TaxSystemKey[]],
    'Неизвестная система налогообложения',
  ),
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

    const { name, slug, timezone, taxSystem } = parsedInput

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

      // Выбор из шага «Налоги» — со ставками по умолчанию для этого режима.
      // `getTaxConfig` завёл бы строку лениво, но всегда с DEFAULT_TAX_SYSTEM,
      // то есть выбор мастера потерялся бы, как только появится второй режим.
      await prisma.taxConfig.create({
        data: {
          taxSystem,
          config: TAX_SYSTEM_CONFIG_SCHEMAS[taxSystem].parse({}) as Prisma.InputJsonValue,
          organizationId: Number(organization.id),
        },
      })

      return { slug }
    } catch (error) {
      // Единственная реальная защита от гонки между checkSlug и созданием —
      // unique-индекс по slug; checkSlug остаётся подсказкой для UI.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Этот адрес уже занят — выберите другой.')
      }
      if (error instanceof APIError) {
        const body = error.body as { code?: string; message?: string } | undefined
        // `message` — до generic-строки: свои `APIError` (например, бросок из
        // `beforeCreateOrganization` про зарезервированный адрес) идут без
        // `code`, и без этой ветки внятная причина подменялась бы на «попробуйте
        // ещё раз» — предложение повторить то, что никогда не сработает.
        throw new ConflictError(
          ORG_ERROR_MESSAGES[body?.code ?? ''] ??
            body?.message ??
            'Не удалось создать школу. Попробуйте ещё раз.',
        )
      }
      throw error
    }
  })
