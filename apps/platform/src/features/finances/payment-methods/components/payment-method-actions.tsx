'use client'

import { PaymentMethod } from '@/prisma/generated/client'
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, MoreVertical, Pen, Trash } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { usePaymentMethodDeleteMutation, usePaymentMethodUpdateMutation } from '../queries'
import { UpdatePaymentMethodSchema, type UpdatePaymentMethodSchemaType } from '../schemas'
import PaymentMethodForm from './payment-method-form'

interface PaymentMethodActionsProps {
  paymentMethod: PaymentMethod
}

export default function PaymentMethodActions({ paymentMethod }: PaymentMethodActionsProps) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const updateMutation = usePaymentMethodUpdateMutation()
  const deleteMutation = usePaymentMethodDeleteMutation()

  const form = useForm<UpdatePaymentMethodSchemaType>({
    resolver: zodResolver(UpdatePaymentMethodSchema),
    defaultValues: {
      id: paymentMethod.id,
      name: paymentMethod.name,
      commission: paymentMethod.commission,
      description: paymentMethod.description ?? '',
      isActive: paymentMethod.isActive,
    },
  })

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: paymentMethod.id },
      {
        onSuccess: () => setConfirmOpen(false),
      },
    )
  }

  const onSubmit = (values: UpdatePaymentMethodSchemaType) => {
    updateMutation.mutate(values, {
      onSuccess: () => {
        setEditDialogOpen(false)
        form.reset()
      },
    })
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreVertical />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-max">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                setEditDialogOpen(true)
                setOpen(false)
              }}
            >
              <Pen />
              Редактировать
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setConfirmOpen(true)
              setOpen(false)
            }}
          >
            <Trash />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать метод оплаты</DialogTitle>
            <DialogDescription>
              Изменение метода оплаты &ldquo;{paymentMethod.name}&rdquo;
            </DialogDescription>
          </DialogHeader>
          <PaymentMethodForm form={form} formId="edit-payment-method-form" />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
            <Button
              type="button"
              disabled={updateMutation.isPending}
              onClick={form.handleSubmit(onSubmit)}
            >
              {updateMutation.isPending && <Loader className="animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить метод оплаты?</AlertDialogTitle>
            <AlertDialogDescription>
              Метод оплаты &ldquo;{paymentMethod.name}&rdquo; будет удалён. У существующих оплат с
              этим методом он будет сброшен на &ldquo;Неизвестно&rdquo;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
            >
              {deleteMutation.isPending && <Loader className="animate-spin" />}
              Удалить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
