'use client'

import { Payment } from '@/prisma/generated/client'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog'
import { Button } from '@/src/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { CircleX, Loader, MoreVertical } from 'lucide-react'
import { useState } from 'react'
import { usePaymentCancelMutation } from '../queries'

interface PaymentActionsProps {
  payment: Payment
}

export default function PaymentActions({ payment }: PaymentActionsProps) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const cancelMutation = usePaymentCancelMutation()

  const handleDelete = () => {
    cancelMutation.mutate({ id: payment.id }, { onSuccess: () => setConfirmOpen(false) })
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreVertical />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-max">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setConfirmOpen(true)
              setOpen(false)
            }}
          >
            <CircleX className="mr-2 h-4 w-4" />
            Отменить оплату
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены, что хотите отменить оплату?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие отменит оплату и не может быть отменено. Это так же повлияет на баланс
              ученика
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={handleDelete}
            >
              {cancelMutation.isPending ? <Loader className="animate-spin" /> : 'Отменить'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
