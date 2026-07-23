'use client'

import { CoinPrice } from '@/src/components/coin-price'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent } from '@repo/ui/components/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@repo/ui/components/empty'
import { Separator } from '@repo/ui/components/separator'
import { Skeleton } from '@repo/ui/components/skeleton'
import Link from 'next/link'
import { useState } from 'react'
import { useCartQuery, useClearCartMutation } from '../queries'
import type { CheckoutIssue } from '../types'
import { CartItemRow } from './cart-item-row'
import { CheckoutButton } from './checkout-button'
import { CheckoutIssues } from './checkout-issues'

export function CartView() {
  const { data, isLoading, isError } = useCartQuery()
  const clear = useClearCartMutation()
  // Проблемы, вернувшиеся с чекаута, важнее предварительных: они актуальнее.
  const [checkoutIssues, setCheckoutIssues] = useState<CheckoutIssue[] | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (isError || !data) {
    return <div className="text-destructive">Не удалось загрузить корзину.</div>
  }

  if (data.items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Корзина пуста</EmptyTitle>
          <EmptyDescription>
            Загляните в магазин — там есть на что потратить коины.
          </EmptyDescription>
        </EmptyHeader>
        <Button render={<Link href="/shop" />}>В магазин</Button>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="divide-y">
          {data.items.map((item) => (
            <CartItemRow key={item.productId} item={item} />
          ))}
        </CardContent>
      </Card>

      <CheckoutIssues issues={checkoutIssues ?? data.issues} />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ваш баланс</span>
            <CoinPrice value={data.coins} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="font-medium">Итого</span>
            <CoinPrice value={data.total} size="lg" />
          </div>
          <CheckoutButton
            items={data.items.map((item) => ({ productId: item.productId, price: item.price }))}
            total={data.total}
            blocked={data.issues.length > 0}
            onIssues={setCheckoutIssues}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" disabled={clear.isPending} onClick={() => clear.mutate()}>
          Очистить корзину
        </Button>
      </div>
    </div>
  )
}
