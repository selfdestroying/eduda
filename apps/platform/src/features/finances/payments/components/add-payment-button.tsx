'use client'

import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { usePaymentCreateMutation } from '../queries'
import { CreatePaymentSchema, type CreatePaymentSchemaType } from '../schemas'
import PaymentForm from './payment-form'

export default function AddPaymentButton() {
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
