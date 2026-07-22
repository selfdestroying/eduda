'use client'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/src/components/ui/empty'
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
