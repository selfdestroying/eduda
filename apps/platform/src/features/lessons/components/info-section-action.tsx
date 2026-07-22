'use client'

import { Button } from '@/src/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { Ban, MoreVertical, Pen, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { CancelLessonDialog, RestoreLessonDialog } from './cancel-lesson-dialog'
import EditLessonDialog from './edit-lesson-dialog'
import { useLessonDetail } from './lesson-detail-context'

export default function InfoSectionAction() {
  const { lesson, isCancelled } = useLessonDetail()
  const [isEditOpen, setEditOpen] = useState(false)
  const [isCancelOpen, setCancelOpen] = useState(false)
  const [isRestoreOpen, setRestoreOpen] = useState(false)

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
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pen />
            Редактировать
          </DropdownMenuItem>
          {isCancelled ? (
            <DropdownMenuItem onClick={() => setRestoreOpen(true)}>
              <RotateCcw />
              Восстановить урок
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
              <Ban />
              Отменить урок
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditLessonDialog lesson={lesson} isOpen={isEditOpen} onClose={() => setEditOpen(false)} />
      <CancelLessonDialog isOpen={isCancelOpen} onClose={() => setCancelOpen(false)} />
      <RestoreLessonDialog isOpen={isRestoreOpen} onClose={() => setRestoreOpen(false)} />
    </>
  )
}
