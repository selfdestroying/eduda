import '@/src/styles/globals.css'
import { source } from '@/src/lib/source'
import { defineTranslations } from 'fumadocs-core/i18n'
import { i18nProvider, uiTranslations } from 'fumadocs-ui/i18n'
import { DocsLayout } from 'fumadocs-ui/layouts/notebook'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { Binary, Home, User } from 'lucide-react'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

// Интерфейс почти целиком на русском: `subsets` управляет предзагрузкой, поэтому
// без `cyrillic` кириллица догружалась отдельным запросом и мелькала фолбэком.
const geistSans = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' })
const geistMono = Geist_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-mono' })

const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
const platformUrl = `${protocol}://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || ''}`

const translations = defineTranslations().extend(uiTranslations()).add({
  // [label]: [translation]
  'On this page(table of contents)': 'На этой странице',
  'Last updated on(page footer)': 'Последнее обновление',
})

export const metadata: Metadata = {
  title: {
    template: '%s | ЕДУДА',
    default: 'Документация | ЕДУДА',
  },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} thin-scrollbar`}
    >
      <body className="font-sans antialiased">
        {/* `RootProvider` сам поднимает next-themes — отдельный ThemeProvider не нужен. */}
        <RootProvider
          i18n={i18nProvider(translations)}
          search={{ enabled: false }}
          theme={{ defaultTheme: 'dark', disableTransitionOnChange: true }}
        >
          <DocsLayout
            tree={source.getPageTree()}
            {...{
              nav: {
                title: 'ЕДУДА',
                url: platformUrl,
              },
              githubUrl: 'https://github.com/selfdestroying/eduda',
              links: [
                {
                  type: 'icon',
                  icon: <Home />,
                  text: 'На главную',
                  url: platformUrl,
                  // secondary items will be displayed differently on navbar
                  secondary: false,
                  external: false,
                },
              ],
            }}
            sidebar={{
              collapsible: false,
            }}
            tabs={[
              {
                title: 'Для пользователей',
                url: '/user',
                icon: <User />,
              },
              {
                title: 'Для разработчиков',
                url: '/dev',
                icon: <Binary />,
              },
            ]}
          >
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  )
}
