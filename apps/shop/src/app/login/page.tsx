import { LoginForm } from '@/src/features/auth/components/login-form'
import { getStudentSession, ORG_UNAVAILABLE } from '@/src/lib/auth/student-session'
import { Logo } from '@repo/ui/components/logo'
import { SwitchThemeButton } from '@repo/ui/components/switch-theme-button'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Вход' }

/**
 * Оформление один в один со входом платформы (`apps/platform/src/app/auth`):
 * та же подложка, тот же брендблок, та же карточка. Вкладок нет — ученик не
 * регистрируется, учётку заводит школа.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  // Тот же резолв, что и у `studentAction`: если школа ученика недоступна,
  // сессия здесь тоже «не считается» и цикла редиректов не возникает.
  const session = await getStudentSession(await headers())
  if (session) {
    redirect('/')
  }

  const orgUnavailable = (await searchParams).error === ORG_UNAVAILABLE

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-4">
      {/* Decorative background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-landing-float bg-primary/10 absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl" />
        <div className="animate-landing-float-delayed bg-primary/8 absolute -bottom-40 -left-40 h-120 w-120 rounded-full blur-3xl" />
      </div>

      {/* Subtle grid pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[4rem_4rem] opacity-30" />

      {/* Theme toggle */}
      <div className="absolute top-5 right-5 z-20">
        <SwitchThemeButton />
      </div>

      <div className="animate-landing-enter relative z-10 flex w-full max-w-sm flex-col items-center">
        {/* Brand */}
        <div className="mb-5.5 flex flex-col items-center gap-3">
          <div className="ring-border/60 bg-card/80 flex size-16 items-center justify-center overflow-hidden rounded-[1.125rem] ring-1">
            <Logo className="text-primary size-10" />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-2xl font-extrabold tracking-tight">ЕДУДА</h1>
            <p className="text-muted-foreground text-xs">Кабинет ученика</p>
          </div>
        </div>

        {/* Card */}
        <div className="ring-border/60 bg-card/80 w-full rounded-[1.125rem] p-5.5 shadow-xl ring-1 shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
          <LoginForm orgUnavailable={orgUnavailable} />
        </div>
      </div>
    </main>
  )
}
