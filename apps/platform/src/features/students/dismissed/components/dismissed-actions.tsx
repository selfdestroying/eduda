import { Button } from '@/src/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { useDismissedReturnMutation } from '@/src/features/students/dismissed/queries'
import { Loader, MoreVertical, Undo } from 'lucide-react'
import { useState } from 'react'

interface DismissedActionsProps {
  studentName: string
  studentId: number
  groupId: number
}

export default function DismissedActions({ studentId, groupId }: DismissedActionsProps) {
  const [open, setOpen] = useState(false)
  const returnMutation = useDismissedReturnMutation()

  const handleReturnToGroup = () => {
    returnMutation.mutate(
      { groupId, studentId },
      {
        onSettled: () => {
          setOpen(false)
        },
      },
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button variant="ghost" />}>
        <MoreVertical />
      </DropdownMenuTrigger>

      <DropdownMenuContent className={'w-max'}>
        <DropdownMenuItem onClick={handleReturnToGroup} disabled={returnMutation.isPending}>
          {returnMutation.isPending ? <Loader className="animate-spin" /> : <Undo />}
          Вернуть в группу
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
