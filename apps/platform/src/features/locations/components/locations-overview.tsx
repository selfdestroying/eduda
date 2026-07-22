'use client'

import { StatCard } from '@/src/components/stat-card'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import { Input } from '@/src/components/ui/input'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useSessionQuery } from '@/src/features/users/me/queries'
import { useRentListQuery } from '@/src/features/finances/rent/queries'
import { useFeatureEnabled } from '@/src/hooks/use-feature-enabled'
import { Building2, MapPinned, Plus, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocationListQuery } from '../queries'
import AddLocationButton from './add-location-button'
import LocationCard from './location-card'

export default function LocationsOverview() {
  const [search, setSearch] = useState('')

  const { data: session } = useSessionQuery()
  const isOwner = session?.memberRole === 'owner'
  const rentFeatureEnabled = useFeatureEnabled('finances.rent')
  const showRent = isOwner && rentFeatureEnabled

  const {
    data: locations = [],
    isLoading: locationsLoading,
    isError: locationsError,
  } = useLocationListQuery()

  const { data: rents = [], isLoading: rentsLoading } = useRentListQuery()

  // Captured once on mount - avoids impure calls during render.
  // Data changes trigger refetches; a full refresh will update "now" accurately.
  const [now] = useState(() => Date.now())

  const filteredLocations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return locations
    return locations.filter((l) => l.name.toLowerCase().includes(q))
  }, [locations, search])

  const stats = useMemo(() => {
    const activeRents = rents.filter((r) => {
      const start = new Date(r.startDate).getTime()
      const end = r.endDate ? new Date(r.endDate).getTime() : Infinity
      return start <= now && now <= end
    })
    const locationsWithRent = new Set(activeRents.map((r) => r.locationId))
    const monthlySpend = activeRents
      .filter((r) => r.isMonthly)
      .reduce((sum, r) => sum + r.amount, 0)
    return {
      totalLocations: locations.length,
      locationsWithActiveRent: locationsWithRent.size,
      monthlySpend,
    }
  }, [locations, rents, now])

  const currency = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  })

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Локации и аренда</CardTitle>
          <CardDescription>
            {showRent
              ? 'Управление локациями организации и расходами на аренду'
              : 'Управление локациями организации'}
          </CardDescription>
          <CardAction>
            <AddLocationButton>
              <Plus />
            </AddLocationButton>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Stats */}
          {showRent && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label="Всего локаций"
                value={rentsLoading || locationsLoading ? '-' : stats.totalLocations}
                icon={MapPinned}
              />
              <StatCard
                label="С активной арендой"
                value={
                  rentsLoading || locationsLoading
                    ? '-'
                    : `${stats.locationsWithActiveRent} / ${stats.totalLocations}`
                }
                icon={Building2}
                variant="success"
                description={
                  stats.totalLocations > 0
                    ? `${Math.round((stats.locationsWithActiveRent / stats.totalLocations) * 100)}% покрытие`
                    : undefined
                }
              />
              <StatCard
                label="Ежемесячные платежи"
                value={rentsLoading ? '-' : currency.format(stats.monthlySpend)}
                icon={Wallet}
                variant="warning"
                hint="Сумма ежемесячных арендных платежей по всем активным контрактам. Разовые платежи за период сюда не входят."
              />
            </div>
          )}

          {/* Search */}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию локации..."
            className="max-w-sm"
          />

          {/* Error / loading / empty */}
          {locationsError && (
            <div className="text-destructive text-sm">Ошибка при загрузке локаций.</div>
          )}

          {locationsLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="text-muted-foreground flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm">
              {locations.length === 0 ? (
                <>
                  <MapPinned className="size-6" />
                  <p>Локации ещё не добавлены</p>
                  <AddLocationButton variant="outline">
                    <Plus />
                    Добавить первую локацию
                  </AddLocationButton>
                </>
              ) : (
                <p>По запросу «{search}» ничего не найдено</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredLocations.map((location) => (
                <LocationCard key={location.id} location={location} showRent={showRent} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
