import { auth } from '@/src/lib/auth/server'
import { NextRequest, NextResponse } from 'next/server'
import { protocol, rootDomain } from './lib/utils'

type SessionData = Awaited<ReturnType<typeof auth.api.getSession>>

const RESERVED_SUBDOMAINS = new Set(['auth', 'admin', 'shop'])

/** Hostname корневого домена без порта */
const rootHostname = rootDomain.split(':')[0]

const AUTH_REDIRECT_BASE = `${protocol}://auth.${rootDomain}/sign-in`
const ROOT_URL = `${protocol}://${rootDomain}`

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

function buildAuthRedirectUrl(request: NextRequest): string {
  const returnTo = encodeURIComponent(request.nextUrl.href)
  return `${AUTH_REDIRECT_BASE}?returnTo=${returnTo}`
}

export async function proxy(request: NextRequest) {
  const subdomain = extractSubdomain(request)

  if (!subdomain) {
    const { pathname } = request.nextUrl
    if (pathname !== '/') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  const { pathname, search } = request.nextUrl

  const session = await auth.api.getSession({
    headers: request.headers,
  })

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
      if (pathname === '/') {
        return NextResponse.redirect(new URL('/sign-in', request.url))
      }
      return NextResponse.rewrite(new URL(`/auth${pathname}${search}`, request.url))
    }

    case 'admin': {
      if (pathname !== '/') {
        return NextResponse.redirect(new URL('/', request.url))
      }
      if (!session) {
        return NextResponse.redirect(buildAuthRedirectUrl(request))
      }
      if (session.userRole === 'admin') {
        return NextResponse.rewrite(new URL(`/admin${pathname}${search}`, request.url))
      }
      return NextResponse.redirect(ROOT_URL)
    }

    case 'shop':
      return NextResponse.rewrite(new URL(`/shop${pathname}${search}`, request.url))

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
    return NextResponse.redirect(buildAuthRedirectUrl(request))
  }

  const isMember = session.organization?.slug === subdomain

  if (!isMember) {
    return NextResponse.redirect(ROOT_URL)
  }

  const response = NextResponse.rewrite(new URL(`/s/${subdomain}${pathname}${search}`, request.url))
  response.headers.set('x-organization', subdomain)
  return response
}

/**
 * Исключаем статические ресурсы, _next, favicon и API-маршруты auth
 * из обработки proxy для оптимизации производительности.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|api/auth).*)'],
}
