import { auth } from '@/src/lib/auth/server'
import { isRouteDisabled } from '@/src/lib/features/registry'
import { NextRequest, NextResponse } from 'next/server'
import {
  extractSubdomain,
  onboardingUrl,
  protocol,
  RESERVED_SUBDOMAINS,
  rootDomain,
  signInUrl,
} from './lib/utils'

type SessionData = Awaited<ReturnType<typeof auth.api.getSession>>

const ROOT_URL = `${protocol}://${rootDomain}`

/** URL кабинета организации. */
const orgUrl = (slug: string) => `${protocol}://${slug}.${rootDomain}`

/**
 * При недоступной БД better-auth обычно возвращает `null` (внутри
 * `getSessionFromCtx` стоит `.catch(() => null)`), но на отдельных путях может и
 * бросить. Ловим, чтобы сбой не превращался в 500 на всех маршрутах сразу:
 * пользователь просто уедет на форму входа, а попытка войти покажет причину.
 */
async function getSessionSafe(request: NextRequest): Promise<SessionData> {
  try {
    return await auth.api.getSession({ headers: request.headers })
  } catch (error) {
    console.error('proxy: не удалось прочитать сессию', error)
    return null
  }
}

export async function proxy(request: NextRequest) {
  const subdomain = extractSubdomain(request.headers.get('host'))
  const { pathname, search } = request.nextUrl

  // Личный кабинет родителя по ключу-ссылке + старый адрес /edit (redirect)
  // — публичные, без поддомена/сессии, обходят проверки proxy.
  if (pathname.startsWith('/cabinet/') || pathname.startsWith('/edit/')) {
    return NextResponse.next()
  }

  if (!subdomain) {
    // Корневой домен: `/landing` — публичная маркетинговая страница.
    if (pathname === '/landing') {
      return NextResponse.next()
    }
    // Всё, кроме `/`, ведём на `/`.
    if (pathname !== '/') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // `/` — гейт входа: есть школа → в школу, вошёл без школы → на онбординг
    // (иначе форма входа отправляла бы залогиненного юзера по кругу),
    // не вошёл → на вход.
    const session = await getSessionSafe(request)
    if (session?.organization) {
      return NextResponse.redirect(orgUrl(session.organization.slug))
    }
    if (session) {
      return NextResponse.redirect(onboardingUrl)
    }
    return NextResponse.redirect(signInUrl)
  }

  const session = await getSessionSafe(request)

  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return handleReservedSubdomain(subdomain, pathname, search, request, session)
  }

  return handleOrgSubdomain(subdomain, pathname, search, request, session)
}

function handleReservedSubdomain(
  subdomain: string,
  pathname: string,
  search: string,
  request: NextRequest,
  session: SessionData,
) {
  switch (subdomain) {
    case 'auth': {
      // От сессии зависят только форма входа и мастер. Прочие пути
      // auth-поддомена остаются поверхностью восстановления и доступны всегда.
      if (pathname === '/' || pathname === '/onboarding') {
        // Школа уже есть — на auth-поддомене делать нечего: при
        // `organizationLimit: 1` вторую всё равно не создать.
        if (session?.organization) {
          return NextResponse.redirect(orgUrl(session.organization.slug))
        }
        // Мастер создания первой школы — только для вошедших.
        if (!session && pathname === '/onboarding') {
          return NextResponse.redirect(signInUrl)
        }
        // Вошёл, но школы ещё нет — с формы входа сразу в мастер.
        if (session && pathname === '/') {
          return NextResponse.redirect(onboardingUrl)
        }
      }
      // `/` — сама страница входа, поэтому хопа на /sign-in больше нет.
      // Для корня отдаём `/auth`, а не `/auth/`, чтобы не плодить редирект на слэше.
      const suffix = pathname === '/' ? '' : pathname
      return NextResponse.rewrite(new URL(`/auth${suffix}${search}`, request.url))
    }

    case 'admin': {
      if (pathname !== '/') {
        return NextResponse.redirect(new URL('/', request.url))
      }
      if (!session) {
        return NextResponse.redirect(signInUrl)
      }
      if (session.userRole === 'admin') {
        return NextResponse.rewrite(new URL(`/admin${pathname}${search}`, request.url))
      }
      return NextResponse.redirect(ROOT_URL)
    }

    case 'shop':
      return NextResponse.rewrite(new URL(`/shop${pathname}${search}`, request.url))

    case 'docs':
      return NextResponse.rewrite(new URL(`/docs${pathname}${search}`, request.url))

    default:
      return NextResponse.next()
  }
}

function handleOrgSubdomain(
  subdomain: string,
  pathname: string,
  search: string,
  request: NextRequest,
  session: SessionData,
) {
  if (!session) {
    return NextResponse.redirect(signInUrl)
  }

  // `session.organization` резолвится по этому же поддомену, так что обычно
  // достаточно проверки на `null`. Slug всё равно сверяем: резолв опирается на
  // заголовок `Host` (`resolveMember`), и если тот однажды не доедет — прокси,
  // CDN, внутренний вызов без заголовков — резолв уйдёт в ветку
  // `activeOrganizationId` и вернёт *свою* школу пользователя. Тогда без этой
  // строки член школы A попал бы в кабинет школы B. Проверка локальная и
  // самодостаточная, поэтому пусть остаётся здесь, а не в инварианте на два файла.
  if (session.organization?.slug !== subdomain) {
    return NextResponse.redirect(ROOT_URL)
  }

  // Feature guard: block access to disabled features
  const disabledFeatures = (session.disabledFeatures as string[] | undefined) ?? []
  if (isRouteDisabled(pathname, disabledFeatures)) {
    return NextResponse.redirect(orgUrl(subdomain))
  }

  const response = NextResponse.rewrite(new URL(`/${subdomain}${pathname}${search}`, request.url))
  response.headers.set('x-organization', subdomain)
  return response
}

/**
 * Исключаем статические ресурсы, _next, favicon и API-маршруты auth
 * из обработки proxy для оптимизации производительности.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|api/).*)'],
}
