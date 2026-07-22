'use client'

import { Toaster } from '@repo/ui/components/sonner'
import { ThemeProvider } from 'next-themes'
import { ReactNode } from 'react'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      {children}
      <Toaster richColors closeButton={false} duration={2000} position="top-center" />
    </ThemeProvider>
  )
}
