'use client'

import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { usePaymentMethodCreateMutation } from '../queries'
import {
  CreatePaymentMethodSchema,
  type CreatePaymentMethodInput,
  type CreatePaymentMethodSchemaType,
} from '../schemas'
import PaymentMethodForm from './payment-method-form'

export default function AddPaymentMethodButton() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const createMutation = usePaymentMethodCreateMutation()

  const form = useForm<CreatePaymentMethodInput, unknown, CreatePaymentMethodSchemaType>({
    resolver: zodResolver(CreatePaymentMethodSchema),
    defaultValues: {
      name: '',
      commission: 0,
      description: '',
      isActive: true,
    },
  })

  const onSubmit = (values: CreatePaymentMethodSchemaType) => {
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
          <DialogTitle>Добавить метод оплаты</DialogTitle>
          <DialogDescription>Создайте новый метод оплаты для организации</DialogDescription>
        </DialogHeader>
        <PaymentMethodForm form={form} formId="create-payment-method-form" />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
          <Button
            type="button"
            disabled={createMutation.isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {createMutation.isPending && <Loader className="animate-spin" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
