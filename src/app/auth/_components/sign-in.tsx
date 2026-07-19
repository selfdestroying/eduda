'use client'

import { Logo } from '@/src/components/logo'
import { SwitchThemeButton } from '@/src/components/switch-theme-button'
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { authClient } from '@/src/lib/auth/client'
import { protocol, rootDomain } from '@/src/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { SignInForm } from './sign-in-form'
import { SignUpForm } from './sign-up-form'

/**
 * Высота активной панели в px — `height: auto` не анимируется переходом:
 * вычисленное значение остаётся `auto`, и transition не запускается.
 * Заодно ловит рост формы при появлении ошибок валидации.
 */
function useMeasuredHeight() {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setHeight(entry?.contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, height }
}

/**
 * `data-active:bg-transparent` — фон активной вкладки рисует `TabsIndicator`.
 * Длительность задаём явно: в базовом классе стоит `transition-all` без неё,
 * иначе цвет подписи перекрашивался бы за дефолтные 150ms, вдвое быстрее пилюли.
 */
const tabTriggerClass =
  'text-muted-foreground rounded-[0.5625rem] text-[0.78125rem] font-semibold duration-(--duration-tab) ease-(--ease-tab) data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent'

export default function SignIn() {
  const panel = useMeasuredHeight()
  const [tab, setTab] = useState('sign-in')
  const isSignIn = tab === 'sign-in'

  const handleSuccess = async () => {
    // Получаем сессию с информацией о членстве в организациях
    const { data: session } = await authClient.getSession()

    // Вход прошёл, но сессия не читается — молча выйти нельзя, иначе форма
    // выглядит так, будто ничего не произошло.
    if (!session) {
      toast.error('Не удалось загрузить сессию. Попробуйте войти ещё раз.')
      return
    }

    if (!session.organization || !session.organization.slug) {
      window.location.href = `${protocol}://${rootDomain}`
      return
    }

    window.location.href = `${protocol}://${session.organization.slug}.${rootDomain}/`
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
            <p className="text-muted-foreground text-xs">Единый учёт данных</p>
          </div>
        </div>

        {/* Card */}
        <div className="ring-border/60 bg-card/80 w-full rounded-[1.125rem] p-5.5 shadow-xl ring-1 shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
          <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="gap-4">
            {/* h-9 задаём вариантом: базовый `group-data-horizontal/tabs:h-8` специфичнее голого h-9 */}
            <TabsList className="bg-muted/70 w-full group-data-horizontal/tabs:h-9">
              <TabsIndicator className="bg-card" />
              <TabsTrigger value="sign-in" className={tabTriggerClass}>
                Вход
              </TabsTrigger>
              <TabsTrigger value="sign-up" className={tabTriggerClass}>
                Регистрация
              </TabsTrigger>
            </TabsList>
            {/* -mx-2/px-2 гасят друг друга: сдвига нет, но край обрезки уходит
                за пределы инпутов, иначе overflow-hidden режет их focus-ring */}
            <div
              style={{ height: panel.height }}
              className="-mx-2 overflow-hidden px-2 transition-[height] duration-(--duration-tab) ease-(--ease-tab) motion-reduce:transition-none"
            >
              <div ref={panel.ref}>
                <TabsContent value="sign-in" className="animate-tab-enter">
                  <SignInForm onSuccess={handleSuccess} />
                </TabsContent>
                <TabsContent value="sign-up" className="animate-tab-enter">
                  <SignUpForm />
                </TabsContent>
              </div>
            </div>

            <p className="text-muted-foreground text-center text-[0.71875rem]">
              {isSignIn ? 'Ещё нет аккаунта?' : 'Уже есть аккаунт?'}
              <button
                type="button"
                onClick={() => setTab(isSignIn ? 'sign-up' : 'sign-in')}
                className="text-primary focus-visible:ring-ring/50 ml-1 rounded-sm font-semibold hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
              >
                {isSignIn ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </p>
          </Tabs>
        </div>

        {/* Footer */}
        {/*<p className="text-muted-foreground/60 mt-5.5 text-center text-[0.6875rem]">
          &copy; {new Date().getFullYear() + ' '} &middot; ЕДУДА &middot; Единый учёт данных
        </p>*/}
      </div>
    </main>
  )
}
