'use client'

import { Order } from '@/prisma/generated/client'
import { CustomCombobox } from '@/src/components/custom-combobox'
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
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Loader, MoreVertical, Pen } from 'lucide-react'
import { useState } from 'react'
import { useChangeOrderStatusMutation } from '../queries'
import { OrderWithProductAndStudent } from '../types'
import { OrderStatusMap } from './orders-table'

interface OrderActionsProps {
  order: OrderWithProductAndStudent
}

export default function OrderActions({ order }: OrderActionsProps) {
  const [open, setOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [status, setStatus] = useState<Order['status']>(order.status)

  const statusItems = [
    { label: OrderStatusMap.PENDING, value: 'PENDING' as const },
    { label: OrderStatusMap.COMPLETED, value: 'COMPLETED' as const },
    { label: OrderStatusMap.CANCELLED, value: 'CANCELLED' as const },
  ]

  const changeStatusMutation = useChangeOrderStatusMutation()

  const handleChangeStatus = () => {
    changeStatusMutation.mutate(
      { id: order.id, newStatus: status },
      {
        onSuccess: () => setEditDialogOpen(false),
      },
    )
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
              Сменить статус
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать заказ</DialogTitle>
            <DialogDescription>Обновите информацию о заказе</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Статус</FieldLabel>
              <CustomCombobox
                items={statusItems}
                value={statusItems.find((i) => i.value === status) ?? null}
                onValueChange={(item) => setStatus((item?.value ?? 'PENDING') as Order['status'])}
                placeholder="Выберите статус"
                showTrigger={false}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
            <Button disabled={changeStatusMutation.isPending} onClick={handleChangeStatus}>
              {changeStatusMutation.isPending && <Loader className="animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
