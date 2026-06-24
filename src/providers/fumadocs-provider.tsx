import { i18nProvider, uiTranslations } from 'fumadocs-ui/i18n'
import { RootProvider } from 'fumadocs-ui/provider/next'

import { ReactNode } from 'react'
import { defineTranslations } from 'fumadocs-core/i18n'

const translations = defineTranslations().extend(uiTranslations()).add({
  // [label]: [translation]
  'On this page(table of contents)': 'На этой странице',
  'Last updated on(page footer)': 'Последнее обновление',
})
export function FumadocsProvider({ children }: { children: ReactNode }) {
  return (
    <RootProvider i18n={i18nProvider(translations)} search={{ enabled: false }}>
      {children}
    </RootProvider>
  )
}
