'use client'

import { Toaster } from '@repo/ui/components/sonner'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { ReactNode, useState } from 'react'

export default function Providers({ children }: { children: ReactNode }) {
  // Кеша данных в кабинете нет: каталог, остатки и коины пишет другое приложение
  // (§5 SPEC), поэтому query-слой держит данные ровно на время взаимодействия.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: 1 } } }),
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors closeButton={false} duration={2000} position="top-center" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
