'use client'

import { Button } from '@/src/components/ui/button'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Decorative background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-landing-float bg-destructive/10 absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl" />
        <div className="animate-landing-float-delayed bg-destructive/8 absolute -bottom-40 -left-40 h-120 w-120 rounded-full blur-3xl" />
      </div>

      {/* Subtle grid pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[4rem_4rem] opacity-30" />

      <div className="animate-landing-enter relative z-10 flex w-full max-w-sm flex-col items-center">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-2xl">
            <AlertTriangle className="text-destructive size-7" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-xl font-bold tracking-tight">Что-то пошло не так</h1>
            <p className="text-muted-foreground max-w-[18rem] text-center text-sm">
              Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.
            </p>
          </div>
        </div>

        <Button onClick={reset} className="h-10 gap-2 rounded-xl px-6 text-sm">
          <RotateCcw className="size-4" />
          Попробовать снова
        </Button>
      </div>
    </main>
  )
}
