'use client'

import { authClient } from '@/src/lib/auth/client'
import { cn } from '@/src/lib/utils'
import { Button } from '@repo/ui/components/button'
import { Logo } from '@repo/ui/components/logo'
import { SwitchThemeButton } from '@repo/ui/components/switch-theme-button'
import {
  CalendarCheck,
  Coins,
  LogOut,
  Package,
  ShoppingBag,
  ShoppingCart,
  Trophy,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'

type NavItem = { href: string; label: string; icon: LucideIcon; shop?: true }

// `shop: true` — пункт скрывается, когда школа выключила магазин. У «Заказов»
// его нет намеренно: история покупок остаётся доступной.
const ITEMS: NavItem[] = [
  { href: '/', label: 'Профиль', icon: User },
  { href: '/attendance', label: 'Посещаемость', icon: CalendarCheck },
  { href: '/coins', label: 'Коины', icon: Coins },
  { href: '/achievements', label: 'Достижения', icon: Trophy },
  { href: '/shop', label: 'Магазин', icon: ShoppingBag, shop: true },
  { href: '/cart', label: 'Корзина', icon: ShoppingCart, shop: true },
  { href: '/orders', label: 'Заказы', icon: Package },
]

export function StudentNav({ shopDisabled }: { shopDisabled: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, startSignOut] = useTransition()

  const signOut = () =>
    startSignOut(async () => {
      await authClient.signOut()
      router.replace('/login')
      router.refresh()
    })

  return (
    <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-4">
        <Logo className="text-primary mr-2 size-6 shrink-0" />
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {ITEMS.filter((item) => !(item.shop && shopDisabled)).map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <SwitchThemeButton />
        <Button variant="ghost" size="icon" onClick={signOut} disabled={signingOut} title="Выйти">
          <LogOut />
        </Button>
      </div>
    </header>
  )
}
