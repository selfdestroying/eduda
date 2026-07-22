'use client'

import { Button } from '@/src/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/src/components/ui/command'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/src/components/ui/item'
import { Kbd } from '@/src/components/ui/kbd'
import { cn, getFullName, getGroupName } from '@/src/lib/utils'
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useGlobalSearchQuery } from '../queries'

export function GlobalSearch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o) setQuery('')
  }

  // ⌘K / Ctrl+K toggle (layout-independent via e.code)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyK' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => {
          if (prev) setQuery('')
          return !prev
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { data, isFetching } = useGlobalSearchQuery(query)

  const navigate = (url: string) => {
    handleOpenChange(false)
    router.push(url)
  }

  const trimmed = query.trim()
  const totalResults =
    (data?.students.length ?? 0) + (data?.groups.length ?? 0) + (data?.members?.length ?? 0)

  return (
    <>
      <Button
        type="button"
        onClick={() => handleOpenChange(true)}
        className={cn(
          'bg-input/30 hover:bg-input/50 text-muted-foreground flex h-8 items-center gap-2 rounded-md border text-xs transition-colors',
          'w-8 justify-center sm:w-full sm:max-w-xs sm:justify-start sm:px-2.5',
          className,
        )}
        aria-label="Глобальный поиск"
      >
        <Search className="shrink-0" />
        <span className="hidden flex-1 truncate text-left sm:inline">Поиск...</span>
        <Kbd className="hidden sm:inline-flex">⌘ K</Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Глобальный поиск"
        description="Поиск по ученикам, группам и сотрудникам"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Поиск по ученикам, группам, сотрудникам..."
            loading={isFetching && trimmed.length >= 2}
          />
          <CommandList>
            {trimmed.length < 2 && <CommandEmpty>Введите минимум 2 символа...</CommandEmpty>}
            {trimmed.length >= 2 && !isFetching && totalResults === 0 && (
              <CommandEmpty>Ничего не найдено</CommandEmpty>
            )}

            {data?.students.length ? (
              <CommandGroup heading="Ученики">
                {data.students.map((s) => (
                  <CommandItem
                    key={`student-${s.id}`}
                    value={`student-${s.id}`}
                    onSelect={() => navigate(`/students/${s.id}`)}
                  >
                    {getFullName(s.firstName, s.lastName)}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {data?.groups.length ? (
              <>
                {data.students.length ? <CommandSeparator /> : null}
                <CommandGroup heading="Группы">
                  {data.groups.map((g) => (
                    <CommandItem
                      key={`group-${g.id}`}
                      value={`group-${g.id}`}
                      onSelect={() => navigate(`/groups/${g.id}`)}
                    >
                      <Item size="xs" className="p-0">
                        <ItemContent>
                          <ItemTitle className="whitespace-nowrap">{getGroupName(g)}</ItemTitle>
                          <ItemDescription>
                            {g.teachers.map((t) => t.teacher.name).join(', ')} | {g.location.name} |{' '}
                            <span
                              className={cn(
                                'tabular-nums',
                                g._count.students >= g.maxStudents && 'text-destructive',
                              )}
                            >
                              {g._count.students}/{g.maxStudents}
                            </span>
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {data?.members?.length ? (
              <>
                {data.students.length || data.groups.length ? <CommandSeparator /> : null}
                <CommandGroup heading="Сотрудники">
                  {data.members.map((m) => (
                    <CommandItem
                      key={`member-${m.userId}`}
                      value={`member-${m.userId}`}
                      onSelect={() => navigate(`/organization/members/${m.userId}`)}
                    >
                      {m.user.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
