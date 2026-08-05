'use client'

import { Button } from '@repo/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { MoreVertical, Pen } from 'lucide-react'
import { useState } from 'react'
import type { MemberWithUser } from '../types'
import EditMemberDialog from './edit-member-dialog'

interface MemberActionsProps {
  member: MemberWithUser
}

export default function MemberActions({ member }: MemberActionsProps) {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" />}>
          <MoreVertical />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-max">
          <DropdownMenuItem
            onClick={() => {
              setEditOpen(true)
              setOpen(false)
            }}
          >
            <Pen />
            Редактировать
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditMemberDialog
        member={member}
        open={editOpen}
        onOpenChange={setEditOpen}
        showTrigger={false}
      />
    </>
  )
}
