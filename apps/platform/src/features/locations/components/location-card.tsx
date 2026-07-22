'use client'

import { Location } from '@/prisma/generated/client'
import { Hint } from '@/src/components/hint'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/src/components/ui/collapsible'
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/src/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/src/components/ui/item'
import AddRentButton from '@/src/features/finances/rent/components/add-rent-button'
import RentActions from '@/src/features/finances/rent/components/rent-actions'
import { useRentListQuery } from '@/src/features/finances/rent/queries'
import type { RentWithLocation } from '@/src/features/finances/rent/types'
import { formatDateOnly } from '@/src/lib/timezone'
import { cn } from '@/src/lib/utils'
import { Building, ChevronDown, MapPin, Plus, Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'
import LocationActions from './location-actions'

interface LocationCardProps {
  location: Location
  /** Show rent section (owner + feature enabled) */
  showRent: boolean
}

const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

function formatPeriod(rent: RentWithLocation) {
  const start = formatDateOnly(rent.startDate, { day: '2-digit', month: 'long', year: 'numeric' })
  if (rent.isMonthly) {
    return `ежемесячно с ${formatDateOnly(rent.startDate, { month: 'long', year: 'numeric' })}`
  }
  const end = rent.endDate
    ? formatDateOnly(rent.endDate, { day: '2-digit', month: 'long', year: 'numeric' })
    : '-'
  return `${start} - ${end}`
}

function classifyRent(rent: RentWithLocation, now: Date): 'active' | 'future' | 'past' {
  const start = new Date(rent.startDate).getTime()
  const end = rent.endDate ? new Date(rent.endDate).getTime() : Infinity
  const t = now.getTime()
  if (t < start) return 'future'
  if (t > end) return 'past'
  return 'active'
}

export default function LocationCard({ location, showRent }: LocationCardProps) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [now] = useState(() => new Date())
  const { data: rents = [] } = useRentListQuery()

  const locationRents = useMemo(
    () => rents.filter((r) => r.locationId === location.id),
    [rents, location.id],
  )

  const { active, other } = useMemo(() => {
    const active: RentWithLocation[] = []
    const other: RentWithLocation[] = []
    const sorted = [...locationRents].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    )
    for (const r of sorted) {
      if (classifyRent(r, now) === 'active') active.push(r)
      else other.push(r)
    }
    return { active, other }
  }, [locationRents, now])

  return (
    <div className="bg-card group/location-card ring-foreground/10 hover:ring-foreground/20 flex flex-col gap-3 rounded-lg p-4 ring-1 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <MapPin className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium">{location.name}</h3>
            {showRent && (
              <p className="text-muted-foreground text-xs">
                {locationRents.length === 0
                  ? 'Аренда не задавалась'
                  : `${locationRents.length} ${pluralize(locationRents.length, ['запись', 'записи', 'записей'])} об аренде`}
              </p>
            )}
          </div>
        </div>
        <LocationActions location={location} />
      </div>

      {showRent && (
        <>
          {/* Active rent section */}
          {active.length > 0 ? (
            <div className="flex flex-col gap-2">
              {active.map((rent) => (
                <ActiveRentRow key={rent.id} rent={rent} />
              ))}
            </div>
          ) : (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building />
                </EmptyMedia>
                <EmptyTitle>Нет активной аренды</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <AddRentButton locationId={location.id} variant="default">
                  <Plus />
                  Добавить аренду
                </AddRentButton>
              </EmptyContent>
            </Empty>
          )}

          {/* Footer: add new + history toggle */}
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            {active.length > 0 && (
              <AddRentButton locationId={location.id} variant="outline">
                <Plus />
                Новая запись
              </AddRentButton>
            )}
            {other.length > 0 && (
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen} className="ml-auto">
                <CollapsibleTrigger
                  render={<Button variant="ghost" className="text-muted-foreground gap-1" />}
                >
                  История ({other.length})
                  <ChevronDown
                    className={cn('size-3.5 transition-transform', historyOpen && 'rotate-180')}
                  />
                </CollapsibleTrigger>
              </Collapsible>
            )}
          </div>

          {other.length > 0 && (
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleContent>
                <div className="flex flex-col gap-1 border-t pt-2">
                  {other.map((rent) => (
                    <HistoryRentRow key={rent.id} rent={rent} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  )
}

function ActiveRentRow({ rent }: { rent: RentWithLocation }) {
  const amount = currency.format(rent.amount)
  return (
    <Item variant={'outline'}>
      <ItemContent>
        <ItemTitle>
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
          >
            {rent.isMonthly ? (
              <>
                <Repeat className="size-2.5" /> Ежемесячно
              </>
            ) : (
              'Период'
            )}
          </Badge>
          <span className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
            {amount}
            {rent.isMonthly && (
              <span className="text-muted-foreground text-xs font-normal"> / мес.</span>
            )}
          </span>
          {rent.comment && <Hint text={rent.comment} />}
        </ItemTitle>
        <ItemDescription>{formatPeriod(rent)}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <RentActions rent={rent} />
      </ItemActions>
    </Item>
  )
}

function HistoryRentRow({ rent }: { rent: RentWithLocation }) {
  return (
    <div className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded px-2 py-1.5">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{currency.format(rent.amount)}</span>
          {rent.isMonthly && (
            <Badge variant="outline" className="text-[10px]">
              <Repeat className="size-2.5" /> Ежемес.
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground truncate text-xs">{formatPeriod(rent)}</p>
      </div>
      <RentActions rent={rent} />
    </div>
  )
}

function pluralize(n: number, forms: [string, string, string]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}
