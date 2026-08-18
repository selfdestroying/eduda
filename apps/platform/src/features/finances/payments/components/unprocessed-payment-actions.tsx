'use client'

import { UnprocessedPayment } from '@repo/db'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/alert-dialog'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
import { Check, CircleX, Loader, MoreVertical } from 'lucide-react'
import { useState } from 'react'
import {
  useUnprocessedPaymentDeleteMutation,
  useUnprocessedPaymentResolveMutation,
} from '../queries'
import { type CreatePackageSchemaType } from '../schemas'
import PaymentForm, { usePaymentForm } from './payment-form'

interface UnprocessedPaymentActionsProps {
  unprocessedPayment: UnprocessedPayment
}

// Вне компонента: `useHasPermission` мемоизирует по ссылке на объект прав.
const CAN_CREATE = { payment: ['create'] } as const
const CAN_DELETE = { payment: ['delete'] } as const

const FORM_ID = 'resolve-payment-form'

export default function UnprocessedPaymentActions({
  unprocessedPayment,
}: UnprocessedPaymentActionsProps) {
  const canCreate = useHasPermission(CAN_CREATE)
  const canDelete = useHasPermission(CAN_DELETE)
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const resolveMutation = useUnprocessedPaymentResolveMutation()
  const deleteMutation = useUnprocessedPaymentDeleteMutation()

  const form = usePaymentForm()

  const onSubmit = (values: CreatePackageSchemaType) => {
    resolveMutation.mutate(
      {
        ...values,
        unprocessedPaymentId: unprocessedPayment.id,
      },
      {
        onSuccess: () => {
          setDialogOpen(false)
          form.reset()
        },
      },
    )
  }

  const handleDelete = () => {
    deleteMutation.mutate({ id: unprocessedPayment.id }, { onSuccess: () => setConfirmOpen(false) })
  }

  // Закрытие очищает форму: она живёт здесь, а содержимое диалога размонтируется
  // со своим состоянием — иначе при повторном открытии остаётся кошелёк без
  // ученика. Подробнее в `add-payment-button.tsx`.
  const handleDialogOpenChange = (next: boolean) => {
    setDialogOpen(next)
    if (!next) form.reset()
  }

  // Ни разобрать, ни удалить — меню пустое, показывать нечего.
  if (!canCreate && !canDelete) return null

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreVertical />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-max">
          {canCreate && (
            <DropdownMenuItem
              onClick={() => {
                setDialogOpen(true)
                setOpen(false)
              }}
            >
              <Check />
              Разобрать оплату
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setConfirmOpen(true)
                setOpen(false)
              }}
            >
              <CircleX />
              Удалить
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Вы уверены, что хотите удалить неразобранную оплату?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Это действие удалит оплату и не может быть отменено.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
            >
              {deleteMutation.isPending ? <Loader className="animate-spin" /> : 'Удалить'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить оплату</DialogTitle>
          </DialogHeader>
          <PaymentForm
            form={form}
            formId={FORM_ID}
            onSubmit={onSubmit}
            disabled={resolveMutation.isPending}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => handleDialogOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" form={FORM_ID} disabled={resolveMutation.isPending}>
              {resolveMutation.isPending && <Loader className="animate-spin" />}
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
