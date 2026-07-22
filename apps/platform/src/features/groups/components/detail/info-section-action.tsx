'use client'

import { Button } from '@/src/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { Archive, CalendarCog, CheckCircle2, MoreVertical, Pen } from 'lucide-react'
import { useState } from 'react'
import type { GroupDetailFull } from '../../types'
import ArchiveGroupDialog from './archive-group-button'
import CompleteGroupDialog from './complete-group-button'
import EditGroupDialog from './edit-group-button'
import ManageScheduleDialog from './manage-schedule-button'

interface InfoSectionActionProps {
  canArchive?: boolean
  group: GroupDetailFull
}

export default function InfoSectionAction({ canArchive, group }: InfoSectionActionProps) {
  const [isEditDialogOpen, setEditDialogOpen] = useState(false)
  const [isScheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [isArchiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [isCompleteDialogOpen, setCompleteDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size={'icon'}>
              <MoreVertical />
            </Button>
          }
        />
        <DropdownMenuContent className="w-max" side="left">
          <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
            <Pen />
            Редактировать информацию
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
            <CalendarCog />
            Расписание и уроки
          </DropdownMenuItem>
          {canArchive && group.status === 'ACTIVE' && (
            <>
              <DropdownMenuItem
                className="text-success focus:bg-success/10 dark:focus:bg-success/20 focus:text-success dark:focus:text-success *:[svg]:text-success focus:**:text-success!"
                onClick={() => setCompleteDialogOpen(true)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Завершить
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setArchiveDialogOpen(true)}>
                <Archive className="h-4 w-4" />
                Архивировать
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditGroupDialog
        group={group}
        isOpen={isEditDialogOpen}
        onClose={() => setEditDialogOpen(false)}
      />
      <ManageScheduleDialog
        groupId={group.id}
        schedules={group.schedules}
        isOpen={isScheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
      />
      <CompleteGroupDialog
        groupId={group.id}
        isOpen={isCompleteDialogOpen}
        onClose={() => setCompleteDialogOpen(false)}
      />
      <ArchiveGroupDialog
        groupId={group.id}
        isOpen={isArchiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
      />
    </>
  )
}
