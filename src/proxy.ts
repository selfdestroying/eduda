import { auth } from '@/src/lib/auth/server'
import { isRouteDisabled } from '@/src/lib/features/registry'
import { NextRequest, NextResponse } from 'next/server'
import { protocol, rootDomain, signInUrl } from './lib/utils'

type SessionData = Awaited<ReturnType<typeof auth.api.getSession>>

const RESERVED_SUBDOMAINS = new Set(['auth', 'admin', 'shop', 'docs'])

/** Hostname корневого домена без порта */
const rootHostname = rootDomain.split(':')[0]

const ROOT_URL = `${protocol}://${rootDomain}`

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

function extractSubdomain(request: NextRequest): string | null {
  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0] ?? ''

  // localhost: поддомен только при наличии точки перед localhost
  if (hostname.endsWith('.localhost')) {
    return hostname.split('.')[0] ?? null
  }
  if (hostname === 'localhost') {
    return null
  }

  // Preview deployment URLs (tenant---branch-name.vercel.app)
  if (hostname.includes('---') && hostname.endsWith('.vercel.app')) {
    return hostname.split('---')[0] ?? null
  }

  // Проверяем, что hostname - поддомен rootHostname (не сам root и не www)
  if (
    hostname !== rootHostname &&
    hostname !== `www.${rootHostname}` &&
    hostname.endsWith(`.${rootHostname}`)
  ) {
    return hostname.replace(`.${rootHostname}`, '')
  }

  return null
}

export async function proxy(request: NextRequest) {
  const subdomain = extractSubdomain(request)
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
    // `/` — гейт входа: вошёл и есть школа → сразу в школу, иначе → на вход.
    const session = await getSessionSafe(request)
    if (session?.organization) {
      return NextResponse.redirect(`${protocol}://${session.organization.slug}.${rootDomain}`)
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
    // `auth` — поверхность восстановления: форму входа показываем всегда,
    // сессию здесь не проверяем.
    case 'auth': {
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

  const isMember = session.organization?.slug === subdomain

  if (!isMember) {
    return NextResponse.redirect(ROOT_URL)
  }

  // Feature guard: block access to disabled features
  const disabledFeatures = (session.disabledFeatures as string[] | undefined) ?? []
  if (isRouteDisabled(pathname, disabledFeatures)) {
    return NextResponse.redirect(new URL(`${protocol}://${subdomain}.${rootDomain}`))
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
