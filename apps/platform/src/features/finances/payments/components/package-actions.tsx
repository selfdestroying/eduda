'use client'

import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
import type { PackageStatus } from '@repo/db/enums'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { CircleX, Loader, MoreVertical } from 'lucide-react'
import { useState } from 'react'
import { usePackageCancelMutation } from '../queries'

interface PackageActionsProps {
  packet: { id: number; status: PackageStatus }
}

// Вне компонента: `useHasPermission` мемоизирует по ссылке на объект прав.
const CAN_CANCEL = { payment: ['delete'] } as const

export default function PackageActions({ packet }: PackageActionsProps) {
  const canCancel = useHasPermission(CAN_CANCEL)
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const cancelMutation = usePackageCancelMutation()

  const handleDelete = () => {
    cancelMutation.mutate({ id: packet.id }, { onSuccess: () => setConfirmOpen(false) })
  }

  // Отменённый пакет трогать больше нечем: запись остаётся в списке как след
  // операции, но действий над ней нет.
  if (packet.status === 'CANCELLED') return null
  if (!canCancel) return null

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreVertical />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-max">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setConfirmOpen(true)
              setOpen(false)
            }}
          >
            <CircleX className="mr-2 h-4 w-4" />
            Отменить пакет
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены, что хотите отменить пакет?</AlertDialogTitle>
            <AlertDialogDescription>
              Пакет останется в списке со статусом «Отменён» — записи о деньгах не удаляются. С
              баланса ученика снимутся только непотраченные уроки: занятия, которые он уже отходил,
              останутся оплаченными.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={handleDelete}
            >
              {cancelMutation.isPending ? <Loader className="animate-spin" /> : 'Отменить'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
