'use client'

import { cn, getFullName } from '@/src/lib/utils'
import { Logo } from '@repo/ui/components/logo'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { Skeleton } from '@repo/ui/components/skeleton'
import { SwitchThemeButton } from '@repo/ui/components/switch-theme-button'
import { CalendarCheck, Home, UserRound, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCabinetDataQuery, useSelectedChild } from '../queries'

type Section = { seg: string; label: string; short?: string; icon: LucideIcon }

// Четыре раздела влезают в нижний бар даже на самом узком телефоне, поэтому
// логики переполнения (как в кабинете ученика) здесь нет.
const SECTIONS: Section[] = [
  { seg: '', label: 'Главная', icon: Home },
  { seg: '/finances', label: 'Финансы', icon: Wallet },
  { seg: '/attendance', label: 'Посещаемость', short: 'Занятия', icon: CalendarCheck },
  { seg: '/profile', label: 'Профиль', icon: UserRound },
]

/**
 * Ссылки разделов. `<Link>` не сохраняет query-строку, а выбранный ребёнок
 * живёт именно в ней — значит `?child=` дописываем в каждый href руками, иначе
 * при переходе между разделами кабинет молча переключается на первого ребёнка.
 */
function useSectionLinks(token: string) {
  const pathname = usePathname()
  const { children, setChild, studentId, childQuery: query } = useSelectedChild(token)

  const base = `/cabinet/${token}`

  const links = SECTIONS.map((section) => {
    const path = `${base}${section.seg}`
    return {
      ...section,
      href: `${path}${query}`,
      active: path === base ? pathname === base : pathname.startsWith(path),
    }
  })

  return { links, children, setChild, studentId, base, query }
}

export function CabinetNav({ token }: { token: string }) {
  const { links, children, setChild, studentId, base, query } = useSectionLinks(token)
  const { data, isPending } = useCabinetDataQuery(token)

  return (
    <header className="bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <Link href={`${base}${query}`} aria-label="На главную">
          <Logo className="text-primary size-6 shrink-0" />
        </Link>

        {isPending ? (
          <Skeleton className="ml-2 hidden h-4 w-32 sm:block" />
        ) : (
          <span className="text-muted-foreground ml-2 hidden truncate text-sm sm:block">
            {data?.organizationName}
          </span>
        )}

        {/*
          На телефоне разделы живут в нижнем баре — здесь остаётся переключатель
          ребёнка и тема. Активный раздел — подчёркиванием по нижней границе.
        */}
        <nav aria-label="Разделы кабинета" className="ml-4 hidden items-center gap-4 md:flex">
          {links.map((link) => (
            <Link
              key={link.seg}
              href={link.href}
              aria-current={link.active ? 'page' : undefined}
              className={cn(
                'relative inline-flex h-14 shrink-0 items-center text-sm font-medium transition-colors',
                link.active
                  ? 'text-foreground after:bg-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {children.length > 1 && studentId != null && (
            <Select value={studentId} onValueChange={(value) => setChild(value as number)}>
              <SelectTrigger size="sm" className="max-w-40" aria-label="Выбрать ребёнка">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {getFullName(child.firstName, child.lastName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <SwitchThemeButton />
        </div>
      </div>
    </header>
  )
}

/** Нижний таб-бар: основная навигация на телефоне (десктоп — ряд ссылок в шапке). */
export function CabinetTabBar({ token }: { token: string }) {
  const { links } = useSectionLinks(token)

  return (
    <nav
      aria-label="Основные разделы"
      className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="flex h-14">
        {links.map((link) => (
          <Link
            key={link.seg}
            href={link.href}
            aria-current={link.active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
              link.active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <link.icon className="size-5" />
            {link.short ?? link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
