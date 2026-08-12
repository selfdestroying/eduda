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
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, CircleX, Loader, MoreVertical } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  useUnprocessedPaymentDeleteMutation,
  useUnprocessedPaymentResolveMutation,
} from '../queries'
import { CreatePaymentSchema, type CreatePaymentSchemaType } from '../schemas'
import PaymentForm from './payment-form'

interface UnprocessedPaymentActionsProps {
  unprocessedPayment: UnprocessedPayment
}

// Вне компонента: `useHasPermission` мемоизирует по ссылке на объект прав.
const CAN_CREATE = { payment: ['create'] } as const
const CAN_DELETE = { payment: ['delete'] } as const

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

  const form = useForm<CreatePaymentSchemaType>({
    resolver: zodResolver(CreatePaymentSchema),
    defaultValues: {
      price: undefined,
      lessonCount: undefined,
      date: undefined,
      paymentMethodId: null,
    },
  })

  const onSubmit = (values: CreatePaymentSchemaType) => {
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить оплату</DialogTitle>
          </DialogHeader>
          <PaymentForm
            form={form}
            formId="resolve-payment-form"
            disabled={resolveMutation.isPending}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button disabled={resolveMutation.isPending} onClick={form.handleSubmit(onSubmit)}>
              {resolveMutation.isPending && <Loader className="animate-spin" />}
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
