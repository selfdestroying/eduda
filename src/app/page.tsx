import { Button } from '@/src/components/ui/button'
import { Building2, House, LogIn } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Logo } from '../components/logo'
import { SwitchThemeButton } from '../components/switch-theme-button'
import { auth } from '../lib/auth/server'
import { protocol, rootDomain } from '../lib/utils'
import { SignOutButton } from './_components/sign-out-button'

export default async function HomePage() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Decorative background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-landing-float bg-primary/10 absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl" />
        <div className="animate-landing-float-delayed bg-primary/8 absolute -bottom-40 -left-40 h-120 w-120 rounded-full blur-3xl" />
      </div>

      {/* Subtle grid pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[4rem_4rem] opacity-30" />

      <div className="animate-landing-enter relative z-10 flex w-full max-w-sm flex-col items-center">
        {/* Theme toggle */}
        <div className="mb-2 flex w-full justify-end">
          <SwitchThemeButton />
        </div>

        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="ring-border/60 bg-card/80 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl ring-1">
            <Logo className="text-primary size-18" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-2xl font-bold tracking-tight">ЕДУДА</h1>
            <p className="text-muted-foreground text-sm">Единый учёт данных</p>
          </div>
        </div>

        {/* Card */}
        <div className="ring-border/60 bg-card/80 w-full rounded-2xl p-6 shadow-xl ring-1 shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
          {!session && (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-center text-sm">
                Войдите, чтобы продолжить работу
              </p>
              <Button
                className="h-10 w-full gap-2 rounded-xl text-sm"
                nativeButton={false}
                render={<Link href={`${protocol}://auth.${rootDomain}`} />}
              >
                Войти
                <LogIn className="size-4" />
              </Button>
            </div>
          )}

          {session && session.organization && (
            <div className="flex flex-col gap-3">
              <div className="mb-1 flex items-center gap-3">
                <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <House className="text-primary size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{session.organization.name}</p>
                  <p className="text-muted-foreground text-xs">{session.user.name}</p>
                </div>
              </div>
              <Button
                className="h-10 w-full gap-2 rounded-xl text-sm"
                nativeButton={false}
                render={<Link href={`${protocol}://${session.organization.slug}.${rootDomain}`} />}
              >
                Перейти в школу
                <House className="size-4" />
              </Button>
              <SignOutButton />
            </div>
          )}

          {session && !session.organization && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                <Building2 className="text-muted-foreground size-5" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">Нет организации</p>
                <p className="text-muted-foreground max-w-[16rem] text-xs leading-relaxed">
                  Вы не состоите ни в одной организации. Обратитесь к администратору для получения
                  приглашения.
                </p>
              </div>
              <div className="w-full">
                <SignOutButton />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-muted-foreground/60 mt-6 text-center text-[0.6875rem]">
          &copy; {new Date().getFullYear()} ЕДУДА
        </p>
      </div>
    </main>
  )
}
