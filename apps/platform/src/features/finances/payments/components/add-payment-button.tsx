'use client'

import { Button } from '@repo/ui/components/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@repo/ui/components/drawer'
import { ScrollArea } from '@repo/ui/components/scroll-area'
import { useIsMobile } from '@repo/ui/hooks/use-mobile'
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
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
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
        setOpen(false)
      },
    })
  }

  // Сервер всё равно откажет (`permissionAction`), но показывать кнопку, которая
  // гарантированно упрётся в «Недостаточно прав», незачем.
  if (!canCreate) return null

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      swipeDirection={isMobile ? 'down' : 'right'}
      showSwipeHandle={isMobile}
    >
      <DrawerTrigger render={<Button size={'icon'} />}>
        <Plus />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="pb-4">
          <DrawerTitle>Добавить оплату</DrawerTitle>
        </DrawerHeader>
        {/* Полей семь, и на телефоне они не влезают в `100dvh - 6rem` — форма
            прокручивается внутри панели, а шапка и кнопки остаются на месте. */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-4">
            <PaymentForm
              form={form}
              formId="create-payment-form"
              disabled={createMutation.isPending}
            />
          </div>
        </ScrollArea>
        <DrawerFooter className="pt-4">
          <DrawerClose render={<Button variant="outline" />}>Отмена</DrawerClose>
          <Button
            type="button"
            disabled={createMutation.isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {createMutation.isPending && <Loader className="animate-spin" />}
            Добавить
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
