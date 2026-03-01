'use client'

import { ReactNode } from 'react'
import { Toaster } from '../components/toaster'
import { TooltipProvider } from '../components/ui/tooltip'
import { QueryProvider } from './query-provider'
import { ThemeProvider } from './theme-provider'

type Props = {
  children: ReactNode
}

const Providers = ({ children }: Props) => {
  return (
    <ThemeProvider>
      <QueryProvider>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}

export default Providers
