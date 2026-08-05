import '@/src/styles/globals.css'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import Providers from '../providers/providers'

// Интерфейс почти целиком на русском: `subsets` управляет предзагрузкой, поэтому
// без `cyrillic` кириллица догружалась отдельным запросом и мелькала фолбэком.
const geistSans = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' })
const geistMono = Geist_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: {
    template: '%s | ЕДУДА',
    default: 'ЕДУДА | Единый учёт данных',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} thin-scrollbar`}
    >
      <body className="font-sans antialiased">
        <NuqsAdapter>
          <Providers>{children}</Providers>
        </NuqsAdapter>
      </body>
    </html>
  )
}
