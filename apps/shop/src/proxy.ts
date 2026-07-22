import { NextRequest, NextResponse } from 'next/server'
import { auth } from './lib/auth/server'

/**
 * Гейт 1 из §7 SPEC: без сессии всё, кроме `/login`, ведёт на `/login`.
 *
 * Гейт 2 (школа недоступна) живёт в `getStudentSession` — он общий для
 * `studentAction` и страницы входа, поэтому проверяется на каждом запросе и без
 * второго round-trip'а в БД из middleware.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/login') {
    return NextResponse.next()
  }

  const session = await auth.api
    .getSession({ headers: request.headers })
    .catch((error: unknown) => {
      console.error('proxy: не удалось прочитать сессию', error)
      return null
    })

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|api/).*)'],
}
