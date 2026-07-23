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
 * Сюда же приходит выключённый школой магазин: `/shop`, `/shop/[id]` и `/cart`
 * отвечают `notFound()`, когда фича отключена (§7.3 SPEC). Поэтому текст
 * объясняет оба случая, а не только «страницы нет».
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md items-center justify-center px-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Compass />
          </EmptyMedia>
          <EmptyTitle>Страница недоступна</EmptyTitle>
          <EmptyDescription>
            Такой страницы нет, либо школа отключила этот раздел. Остальной кабинет работает как
            обычно.
          </EmptyDescription>
        </EmptyHeader>
        <Button render={<Link href="/" />}>В кабинет</Button>
      </Empty>
    </div>
  )
}
