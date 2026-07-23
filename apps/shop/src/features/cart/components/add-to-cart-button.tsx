'use client'

import { Button } from '@repo/ui/components/button'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@repo/ui/components/number-field'
import { Loader, ShoppingCart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAddToCartMutation } from '../queries'

export function AddToCartButton({
  productId,
  available,
}: {
  productId: number
  available: number
}) {
  const [quantity, setQuantity] = useState(1)
  const router = useRouter()
  const add = useAddToCartMutation()

  if (available <= 0) {
    return (
      <Button disabled className="w-full">
        Нет в наличии
      </Button>
    )
  }

  const submit = () =>
    add.mutate(
      { productId, quantity },
      {
        onSuccess: () => {
          toast.success('Добавлено в корзину')
          // Остаток на странице — серверный, обновляем его вместе с корзиной.
          router.refresh()
        },
      },
    )

  return (
    <div className="flex items-center gap-2">
      <NumberField
        className="w-28"
        value={quantity}
        min={1}
        max={Math.min(available, 999)}
        onValueChange={(value) => setQuantity(value ?? 1)}
      >
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
      <Button className="flex-1" disabled={add.isPending} onClick={submit}>
        {add.isPending ? <Loader className="animate-spin" /> : <ShoppingCart />}В корзину
      </Button>
    </div>
  )
}
