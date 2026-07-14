'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog'
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, MoreVertical, Pen, Trash } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useManagerSalaryDeleteMutation, useManagerSalaryUpdateMutation } from '../queries'
import { UpdateManagerSalarySchema, type UpdateManagerSalarySchemaType } from '../schemas'
import type { ManagerSalaryWithUser } from '../types'
import ManagerSalaryForm from './manager-salary-form'

interface Props {
  salary: ManagerSalaryWithUser
}

export default function ManagerSalaryActions({ salary }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const updateMutation = useManagerSalaryUpdateMutation()
  const deleteMutation = useManagerSalaryDeleteMutation()

  const form = useForm<UpdateManagerSalarySchemaType>({
    resolver: zodResolver(UpdateManagerSalarySchema),
    defaultValues: {
      id: salary.id,
      userId: salary.userId,
      monthlyAmount: salary.monthlyAmount,
      month: new Date(salary.startDate).getUTCMonth(),
      year: new Date(salary.startDate).getUTCFullYear(),
      comment: salary.comment ?? undefined,
    },
  })

  const onSubmit = (values: UpdateManagerSalarySchemaType) => {
    updateMutation.mutate(values, {
      onSuccess: () => setEditOpen(false),
    })
  }

  const onDelete = () => {
    deleteMutation.mutate({ id: salary.id }, { onSuccess: () => setDeleteOpen(false) })
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" />}>
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-max">
          <DropdownMenuItem
            onClick={() => {
              setEditOpen(true)
              setMenuOpen(false)
            }}
          >
            <Pen />
            Редактировать
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setDeleteOpen(true)
              setMenuOpen(false)
            }}
          >
            <Trash />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать зарплату</DialogTitle>
            <DialogDescription>Изменение активной записи о зарплате менеджера.</DialogDescription>
          </DialogHeader>
          <ManagerSalaryForm form={form} formId="edit-manager-salary-form" disableUserSelect />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
            <Button
              type="button"
              disabled={updateMutation.isPending}
              onClick={form.handleSubmit(onSubmit)}
            >
              {updateMutation.isPending && <Loader className="animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись будет удалена безвозвратно. Это может изменить расчёты зарплаты за прошлые
              периоды.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={onDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader className="animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
