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
import { Loader, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSellPackageMutation } from '../queries'
import { type SellPackageSchemaType } from '../schemas'
import PaymentForm, { usePaymentForm } from './payment-form'

// Вне компонента: `useHasPermission` мемоизирует по ссылке на объект прав.
const CAN_CREATE = { payment: ['create'] } as const

const FORM_ID = 'sell-package-form'

export default function SellPackageButton() {
  const canCreate = useHasPermission(CAN_CREATE)
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const createMutation = useSellPackageMutation()

  const form = usePaymentForm()

  const onSubmit = (values: SellPackageSchemaType) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        form.reset()
        setOpen(false)
      },
    })
  }

  /**
   * Закрытие панели очищает форму.
   *
   * Форма живёт здесь и закрытие переживает, а содержимое панели размонтируется
   * вместе со своим состоянием — там лежит имя выбранного ученика. Без сброса
   * при повторном открытии оставался кошелёк без ученика: id в форме есть, имени
   * показать нечем. Чинить это переносом имени наверх было бы хуже: черновик
   * оплаты, тихо переживший «Отмену», — плохая находка в форме про деньги.
   */
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) form.reset()
  }

  // Сервер всё равно откажет (`permissionAction`), но показывать кнопку, которая
  // гарантированно упрётся в «Недостаточно прав», незачем.
  if (!canCreate) return null

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      swipeDirection={isMobile ? 'down' : 'right'}
      showSwipeHandle={isMobile}
    >
      <DrawerTrigger render={<Button size={'icon'} />}>
        <Plus />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="pb-4">
          <DrawerTitle>Добавить пакет</DrawerTitle>
        </DrawerHeader>
        {/* На телефоне поля не влезают в `100dvh - 6rem` — форма прокручивается
            внутри панели, а шапка и кнопки остаются на месте. */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-4">
            <PaymentForm
              form={form}
              formId={FORM_ID}
              onSubmit={onSubmit}
              disabled={createMutation.isPending}
            />
          </div>
        </ScrollArea>
        <DrawerFooter className="pt-4">
          <DrawerClose render={<Button variant="outline" />}>Отмена</DrawerClose>
          {/* Кнопка вне формы, поэтому связь через `form` — заодно Enter в поле
              отправляет форму сам, без отдельного обработчика. */}
          <Button type="submit" form={FORM_ID} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader className="animate-spin" />}
            Добавить
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
