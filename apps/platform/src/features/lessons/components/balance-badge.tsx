'use client'

import { Badge } from '@/src/components/ui/badge'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

interface BalanceBadgeProps {
  balance: number | string
}

export default function BalanceBadge({ balance }: BalanceBadgeProps) {
  const [isRevealed, setIsRevealed] = useState(false)

  return (
    <Badge
      className="group flex h-6 w-14 cursor-pointer items-center justify-center text-center"
      variant={'outline'}
      onClick={() => setIsRevealed(!isRevealed)}
    >
      {isRevealed ? (
        <span className="inline text-xs group-hover:hidden">
          {balance.toLocaleString('ru-RU')} ₽
        </span>
      ) : (
        <EyeOff className="inline group-hover:hidden" />
      )}
      {isRevealed ? (
        <EyeOff className="hidden group-hover:inline" />
      ) : (
        <Eye className="hidden group-hover:inline" />
      )}
    </Badge>
  )
}
