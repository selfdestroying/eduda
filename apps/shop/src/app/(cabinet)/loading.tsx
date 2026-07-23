import { Skeleton } from '@repo/ui/components/skeleton'

// Все страницы кабинета — force-dynamic и ходят в БД на каждый запрос, поэтому
// переход между вкладками без скелета выглядел бы как зависший интерфейс.
export default function CabinetLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}
