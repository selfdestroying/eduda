'use client'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/dialog'
import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { usePaymentCreateMutation } from '../queries'
import { CreatePaymentSchema, type CreatePaymentSchemaType } from '../schemas'
import PaymentForm from './payment-form'

// Вне компонента: `useHasPermission` мемоизирует по ссылке на объект прав.
const CAN_CREATE = { payment: ['create'] } as const

export default function AddPaymentButton() {
  const canCreate = useHasPermission(CAN_CREATE)
  const [dialogOpen, setDialogOpen] = useState(false)
  const createMutation = usePaymentCreateMutation()

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
    createMutation.mutate(values, {
      onSuccess: () => {
        form.reset()
        setDialogOpen(false)
      },
    })
  }

  // Сервер всё равно откажет (`permissionAction`), но показывать кнопку, которая
  // гарантированно упрётся в «Недостаточно прав», незачем.
  if (!canCreate) return null

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger render={<Button size={'icon'} />}>
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить оплату</DialogTitle>
        </DialogHeader>
        <PaymentForm form={form} formId="create-payment-form" disabled={createMutation.isPending} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
          <Button
            type="button"
            disabled={createMutation.isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {createMutation.isPending && <Loader className="animate-spin" />}
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
