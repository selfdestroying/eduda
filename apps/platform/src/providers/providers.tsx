'use client'

import { ReactNode } from 'react'
import { Toaster } from '@repo/ui/components/sonner'
import { QueryProvider } from './query-provider'
import { ThemeProvider } from './theme-provider'

type Props = {
  children: ReactNode
}

const Providers = ({ children }: Props) => {
  return (
    <ThemeProvider>
      <QueryProvider>
        {children}
        <Toaster richColors closeButton={false} duration={2000} position="top-center" />
      </QueryProvider>
    </ThemeProvider>
  )
}

export default Providers
