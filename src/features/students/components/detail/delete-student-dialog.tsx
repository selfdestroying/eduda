'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog'
import { Button } from '@/src/components/ui/button'
import { Field, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { getFullName } from '@/src/lib/utils'
import { Loader, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useStudentDeleteMutation } from '../../queries'

type DeletableStudent = {
  id: number
  firstName: string
  lastName: string | null
}

export default function DeleteStudentDialog({
  student,
  redirectTo,
}: {
  student: DeletableStudent
  /** Куда перейти после удаления. На странице ученика — список; в таблице не задаётся. */
  redirectTo?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const deleteMutation = useStudentDeleteMutation()

  const fullName = getFullName(student.firstName, student.lastName)
  const isConfirmed = confirmText.trim() === fullName.trim()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setConfirmText('')
  }

  const handleDelete = () => {
    if (!isConfirmed) return
    deleteMutation.mutate(
      { id: student.id },
      {
        onSuccess: () => {
          setOpen(false)
          if (redirectTo) router.push(redirectTo)
        },
      },
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="destructive" size="icon" onClick={() => setOpen(true)}>
        <Trash />
      </Button>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить ученика {fullName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Это действие необратимо. Будут безвозвратно удалены все данные ученика: группы,
            кошельки, посещения, оплаты, история баланса, заказы в магазине и личный кабинет.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Field>
          <FieldLabel htmlFor="delete-student-confirm">
            Для подтверждения введите имя ученика: <span className="font-medium">{fullName}</span>
          </FieldLabel>
          <Input
            id="delete-student-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={fullName}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isConfirmed) handleDelete()
            }}
          />
        </Field>

        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!isConfirmed || deleteMutation.isPending}
            onClick={handleDelete}
          >
            {deleteMutation.isPending ? <Loader className="animate-spin" /> : 'Удалить навсегда'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
