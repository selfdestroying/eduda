'use client'

import { Button } from '@repo/ui/components/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/empty'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto flex min-h-svh max-w-md items-center justify-center px-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Что-то пошло не так</EmptyTitle>
          <EmptyDescription>
            Не удалось загрузить страницу. Попробуйте ещё раз — данные не пострадали.
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={reset}>
          <RotateCcw />
          Попробовать снова
        </Button>
      </Empty>
    </div>
  )
}
