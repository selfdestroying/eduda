'use client'

import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
import { Button } from '@repo/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { Loader, MoreVertical, Undo } from 'lucide-react'
import { useState } from 'react'
import { useReturnToGroupMutation } from '../queries'

/**
 * Вне компонента: `useHasPermission` мемоизирует по ссылке на объект, и литерал
 * внутри пересчитывал бы проверку на каждый рендер.
 */
const RETURN_PERMISSION = { studentGroup: ['update'] } as const

export default function DismissedActions({
  studentId,
  groupId,
}: {
  studentId: number
  groupId: number
}) {
  const [open, setOpen] = useState(false)
  const canReturn = useHasPermission(RETURN_PERMISSION)
  const returnMutation = useReturnToGroupMutation()

  if (!canReturn) return null

  return (
    // Гасим всплытие здесь, а не в ячейке: пустая обёртка в ячейке съедала бы
    // клик по строке там, где меню не рисуется.
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" />}>
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-max">
          <DropdownMenuItem
            onClick={() =>
              returnMutation.mutate({ groupId, studentId }, { onSettled: () => setOpen(false) })
            }
            disabled={returnMutation.isPending}
          >
            {returnMutation.isPending ? <Loader className="animate-spin" /> : <Undo />}
            Вернуть в группу
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
