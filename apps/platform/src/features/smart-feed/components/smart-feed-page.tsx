'use client'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/empty'
import { Construction } from 'lucide-react'

export default function SmartFeedPage() {
  return (
    <Empty className="bg-card ring-foreground/10 ring-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Construction />
        </EmptyMedia>
        <EmptyTitle>Страница на переработке</EmptyTitle>
        <EmptyDescription>Зайдите позже</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
