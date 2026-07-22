'use client'

import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useExpenseCreateMutation } from '../queries'
import { CreateExpenseSchema, type CreateExpenseSchemaType } from '../schemas'
import ExpenseForm from './expense-form'

export default function AddExpenseButton() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const createMutation = useExpenseCreateMutation()

  const form = useForm<CreateExpenseSchemaType>({
    resolver: zodResolver(CreateExpenseSchema),
    defaultValues: {
      name: '',
      amount: undefined,
      date: undefined,
      comment: undefined,
    },
  })

  const onSubmit = (values: CreateExpenseSchemaType) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        form.reset()
        setDialogOpen(false)
      },
    })
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger render={<Button size={'icon'} />}>
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить расход</DialogTitle>
          <DialogDescription>Укажите название, сумму и дату расхода</DialogDescription>
        </DialogHeader>
        <ExpenseForm form={form} formId="create-expense-form" />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
          <Button
            type="button"
            disabled={createMutation.isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {createMutation.isPending && <Loader className="animate-spin" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
