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
import { type DefaultValues, useForm } from 'react-hook-form'
import { useManagerSalaryCreateMutation } from '../queries'
import { CreateManagerSalarySchema, type CreateManagerSalarySchemaType } from '../schemas'
import ManagerSalaryForm from './manager-salary-form'

interface AddManagerSalaryButtonProps {
  userId?: number
}

export default function AddManagerSalaryButton({ userId }: AddManagerSalaryButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const createMutation = useManagerSalaryCreateMutation()

  const buildDefaults = (): DefaultValues<CreateManagerSalarySchemaType> => ({
    userId,
    monthlyAmount: undefined,
    year: undefined,
    month: undefined,
    comment: undefined,
  })

  const form = useForm<CreateManagerSalarySchemaType>({
    resolver: zodResolver(CreateManagerSalarySchema),
    defaultValues: buildDefaults(),
  })

  const onSubmit = (values: CreateManagerSalarySchemaType) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        form.reset(buildDefaults())
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
          <DialogTitle>Добавить зарплату менеджера</DialogTitle>
          <DialogDescription>
            Фиксированная сумма в месяц. Прошлая активная запись будет автоматически закрыта.
          </DialogDescription>
        </DialogHeader>
        <ManagerSalaryForm
          form={form}
          formId="create-manager-salary-form"
          disableUserSelect={userId !== undefined}
        />
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
