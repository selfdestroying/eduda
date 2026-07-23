'use client'

import { CoinPrice } from '@/src/components/coin-price'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@repo/ui/components/number-field'
import { X } from 'lucide-react'
import Image from 'next/image'
import { useRemoveCartItemMutation, useSetCartItemQuantityMutation } from '../queries'

export interface CartItem {
  productId: number
  name: string
  imageUrl: string
  price: number
  quantity: number
  available: number
  archived: boolean
}

export function CartItemRow({ item }: { item: CartItem }) {
  const setQuantity = useSetCartItemQuantityMutation()
  const remove = useRemoveCartItemMutation()
  const busy = setQuantity.isPending || remove.isPending

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-md">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="56px" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        <div className="flex items-center gap-2">
          <CoinPrice value={item.price} />
          {item.archived ? (
            <Badge variant="secondary">Снят с продажи</Badge>
          ) : (
            item.available < item.quantity && (
              <Badge variant="secondary">осталось {item.available}</Badge>
            )
          )}
        </div>
      </div>

      <NumberField
        className="w-24"
        value={item.quantity}
        min={1}
        max={999}
        disabled={busy || item.archived}
        onValueChange={(value) => {
          if (value === null || value === item.quantity) return
          setQuantity.mutate({ productId: item.productId, quantity: value })
        }}
      >
        <NumberFieldGroup size="sm">
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>

      <Button
        variant="ghost"
        size="icon"
        disabled={busy}
        title="Убрать"
        onClick={() => remove.mutate({ productId: item.productId })}
      >
        <X />
      </Button>
    </div>
  )
}
