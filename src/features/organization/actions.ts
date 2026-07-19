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
import { TAX_SYSTEM_CONFIG_SCHEMAS, TAX_SYSTEMS, type TaxSystemKey } from './tax-systems/schemas'

/** better-auth отдаёт свои ошибки по-английски — переводим по коду. */
const ORG_ERROR_MESSAGES: Record<string, string> = {
  ORGANIZATION_ALREADY_EXISTS: 'Этот адрес уже занят — выберите другой.',
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS: 'У вас уже есть школа.',
}

const ENABLED_TAX_SYSTEMS = TAX_SYSTEMS.filter((t) => t.enabled).map((t) => t.value) as [
  TaxSystemKey,
  ...TaxSystemKey[],
]

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
  // Только включённые режимы — тот же источник, по которому UI гасит кнопки.
  // Расчёт налогов пока умеет один USN_INCOME (`finances/profit/actions.ts`),
  // на остальных он молча вернул бы нули, а отчёт всё равно подписал бы их
  // «ОСНО». Экшен публичный, так что мимо UI это иначе прошло бы.
  taxSystem: z.enum(ENABLED_TAX_SYSTEMS, 'Эта система налогообложения пока недоступна'),
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

    // Только создание школы: всё, что бросается отсюда, — реальный отказ,
    // о котором пользователю есть смысл сообщить. Донастройка ниже намеренно
    // вынесена за try, чтобы её сбой не выдавался за несозданную школу.
    let organization
    try {
      // Заводит Organization + Member с ролью owner и проставляет
      // activeOrganizationId в текущей сессии.
      organization = await auth.api.createOrganization({
        headers: requestHeaders,
        body: { name, slug },
      })
      if (!organization) throw new ConflictError('Не удалось создать школу')
    } catch (error) {
      // Единственная реальная защита от гонки между checkSlug и созданием —
      // unique-индекс по slug; checkSlug остаётся подсказкой для UI. Ловим
      // здесь, а не вокруг всего экшена: P2002 бывает и у `TaxConfig`
      // (`organizationId @unique`), и приписывать его адресу — врать.
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

    // ponytail: `createOrganization` — вызов better-auth, в одну транзакцию с
    // этими записями его не завернуть. Поэтому их сбой не отменяет школу и не
    // должен выглядеть как провал: пользователь уже владелец, а таймзона и
    // налоги правятся в «Организация». Бросить здесь — значит показать ошибку
    // на созданной школе и запереть в мастере: повтор упрётся в
    // `organizationLimit: 1`, а сам мастер никуда не ведёт.
    try {
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
    } catch (error) {
      console.error('createSchool: школа создана, донастройка не удалась', { slug, error })
    }

    return { slug }
  })
