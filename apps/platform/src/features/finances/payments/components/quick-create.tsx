'use client'

import { Button } from '@repo/ui/components/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@repo/ui/components/drawer'
import { Loader, X } from 'lucide-react'
import type { ReactNode } from 'react'

interface QuickCreateProps {
  /** Панель вместо блока под полем. Решает вызывающий: он же знает про `useIsMobile`. */
  asDrawer: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Заголовок панели. На десктопе не показывается — там подпись уже стоит над полем. */
  title: string
  /** Поля ввода. Одни и те же в обоих видах — иначе они разъедутся. */
  children: ReactNode
  /** Условия схемы: кнопка не предлагает отправку, которой сервер откажет. */
  canSubmit: boolean
  pending: boolean
  onSubmit: () => void
}

/**
 * Создание связанной сущности (кошелька, продукта) не выходя из формы оплаты.
 *
 * Два вида, потому что места разное количество. На десктопе создание занимает
 * место выбора: это одно и то же поле в двух состояниях, и форма от переключения
 * не прыгает. На телефоне так не выходит — форма оплаты и сама уже открыта панелью
 * на `100dvh - 6rem`, и три поля, вставшие в неё изнутри, выталкивают за край всё
 * остальное. Поэтому там вложенная панель: базовый `Drawer` умеет стек сам
 * (родитель отъезжает и притухает), а поля получают свой экран целиком.
 *
 * Поля ввода приходят снаружи и в обоих видах одни и те же — расходиться им нельзя.
 */
export function QuickCreate({
  asDrawer,
  open,
  onOpenChange,
  title,
  children,
  canSubmit,
  pending,
  onSubmit,
}: QuickCreateProps) {
  const submitButton = (
    <Button type="button" onClick={onSubmit} disabled={pending || !canSubmit}>
      {pending && <Loader className="animate-spin" />}
      Создать
    </Button>
  )

  if (asDrawer) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="down" showSwipeHandle>
        <DrawerContent>
          <DrawerHeader className="pb-4">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4">{children}</div>
          <DrawerFooter className="pt-4">
            <DrawerClose render={<Button variant="outline" />} disabled={pending}>
              Отмена
            </DrawerClose>
            {submitButton}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  if (!open) return null

  return (
    <div className="flex flex-col gap-2">
      {children}
      <div className="flex items-center gap-2">
        {submitButton}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          disabled={pending}
          aria-label="Отменить создание"
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
