import { prisma } from '@repo/db'
import { cache } from 'react'
import { auth } from './server'

export type StudentSession = {
  student: { id: number; organizationId: number }
  org: { id: number; slug: string; timezone: string }
  disabledShop: boolean
}

/** Маркер в `/login?error=`: вход прошёл, но школы ученика больше нет (§8 SPEC). */
export const ORG_UNAVAILABLE = 'org'

/** Сессия better-auth сама по себе, без доменной обвязки. Кешируется на рендер. */
const getAuthSession = cache(async (reqHeaders: Headers) =>
  auth.api.getSession({ headers: reqHeaders }).catch((error: unknown) => {
    console.error('getStudentSession: не удалось прочитать сессию', error)
    return null
  }),
)

/**
 * Куда вести после неудачного резолва. Разводит два случая, которые снаружи
 * выглядят одинаково: истёкшая сессия — это «войдите заново», а живая сессия без
 * `StudentAccount` — «школа недоступна». Второму нужен текст из §8 SPEC.
 */
export async function loginRedirect(reqHeaders: Headers): Promise<string> {
  return (await getAuthSession(reqHeaders)) ? `/login?error=${ORG_UNAVAILABLE}` : '/login'
}

/**
 * Единственный резолв «кто это и из какой школы».
 *
 * Организация приходит ИЗ СЕССИИ, а не из поддомена — домен у кабинета единый.
 * Здесь же гейт 2 из §7 SPEC: если школа удалена (каскад снёс `StudentAccount`),
 * живая кука перестаёт что-либо значить со следующего же запроса.
 *
 * ponytail: саму куку не гасим — она проверяется на каждом запросе и без
 * `StudentAccount` не открывает ничего. Активная инвалидация понадобится, только
 * если появится что-то читаемое по одной лишь better-auth-сессии.
 */
async function resolve(reqHeaders: Headers): Promise<StudentSession | null> {
  // Нет сессии — это просто «войдите», а не «школа недоступна»: сессия могла
  // истечь на уже открытой странице. Разводит эти случаи `loginRedirect`.
  const session = await getAuthSession(reqHeaders)
  if (!session) return null

  const account = await prisma.studentAccount.findUnique({
    where: { studentUserId: Number(session.user.id) },
    select: {
      studentId: true,
      organizationId: true,
      organization: {
        select: {
          id: true,
          slug: true,
          timezone: true,
          features: { where: { featureKey: 'shop' }, select: { enabled: true } },
        },
      },
    },
  })
  if (!account) return null

  const { organization } = account
  return {
    student: { id: account.studentId, organizationId: account.organizationId },
    org: { id: organization.id, slug: organization.slug, timezone: organization.timezone },
    // В БД хранятся только ВЫКЛЮЧЕННЫЕ override'ы, отсутствие строки = включено.
    disabledShop: organization.features[0]?.enabled === false,
  }
}

/** Дедуплицируется в пределах одного рендера: страница и навигация спрашивают одно и то же. */
export const getStudentSession = cache(resolve)
