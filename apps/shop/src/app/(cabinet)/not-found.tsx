import { Button } from '@repo/ui/components/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/empty'
import { Compass } from 'lucide-react'
import Link from 'next/link'

/**
 * Внутри кабинета `notFound()` — это чаще всего выключённый школой магазин
 * (`/shop`, `/shop/[id]`, `/cart` при отключённой фиче, §7.3 SPEC). Такая
 * страница обязана сохранить навигацию: остальной кабинет продолжает работать,
 * и уводить ученика в тупик не за что.
 */
export default function CabinetNotFound() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Compass />
        </EmptyMedia>
        <EmptyTitle>Раздел недоступен</EmptyTitle>
        <EmptyDescription>
          Такой страницы нет, либо школа отключила этот раздел. Остальные разделы кабинета работают
          как обычно.
        </EmptyDescription>
      </EmptyHeader>
      <Button nativeButton={false} render={<Link href="/" />}>
        В профиль
      </Button>
    </Empty>
  )
}
