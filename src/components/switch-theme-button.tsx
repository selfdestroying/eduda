'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/src/components/ui/button'
import { useSyncExternalStore } from 'react'

export function SwitchThemeButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  return (
    <Button
      variant="outline"
      size="icon-lg"
      aria-label="Сменить тему"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {mounted && (resolvedTheme === 'dark' ? <Moon /> : <Sun />)}
    </Button>
  )
}
