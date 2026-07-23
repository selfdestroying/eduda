'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@repo/ui/components/alert-dialog'
import { Button } from '@repo/ui/components/button'
import { Loader } from 'lucide-react'
import { useState } from 'react'
import { useCheckoutMutation } from '../queries'
import type { CheckoutIssue } from '../types'

interface CheckoutButtonProps {
  items: { productId: number; price: number }[]
  total: number
  blocked: boolean
  onIssues: (issues: CheckoutIssue[]) => void
}

export function CheckoutButton({ items, total, blocked, onIssues }: CheckoutButtonProps) {
  const [open, setOpen] = useState(false)
  const checkout = useCheckoutMutation((issues) => {
    setOpen(false)
    onIssues(issues)
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button className="w-full" disabled={blocked || items.length === 0} />}
      >
        Оформить заказ
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Оформить заказ на {total} коинов?</AlertDialogTitle>
          <AlertDialogDescription>
            Коины спишутся сразу. Отменить заказ может только школа.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <Button
            disabled={checkout.isPending}
            // Цены отправляем те, что видит ученик: только так сервер поймёт,
            // что товар подорожал между открытием корзины и подтверждением.
            onClick={() => checkout.mutate({ expected: items })}
          >
            {checkout.isPending ? <Loader className="animate-spin" /> : 'Подтвердить'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
