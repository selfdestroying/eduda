'use client'

import { Logo } from '@/src/components/logo'
import { SwitchThemeButton } from '@/src/components/switch-theme-button'
import { authClient } from '@/src/lib/auth/client'
import { protocol, rootDomain } from '@/src/lib/utils'
import { SignInForm } from './sign-in-form'

export default function SignIn() {
  const handleSuccess = async () => {
    // Получаем сессию с информацией о членстве в организациях
    const { data: session } = await authClient.getSession()

    if (!session) {
      return
    }

    if (!session.organization || !session.organization.slug) {
      window.location.href = `${protocol}://${rootDomain}`
      return
    }

    window.location.href = `${protocol}://${session.organization.slug}.${rootDomain}/dashboard`
  }

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
          <SignInForm onSuccess={handleSuccess} />
        </div>

        {/* Footer */}
        <p className="text-muted-foreground/60 mt-6 text-center text-[0.6875rem]">
          &copy; {new Date().getFullYear()} ЕДУДА
        </p>
      </div>
    </main>
  )
}
