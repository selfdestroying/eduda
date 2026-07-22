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
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useRentCreateMutation } from '../queries'
import { CreateRentSchema, type CreateRentSchemaType } from '../schemas'
import RentForm from './rent-form'

interface AddRentButtonProps {
  /** Pre-select a location and hide the picker */
  locationId?: number
  children?: ReactNode
  size?: 'default' | 'sm' | 'icon'
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  className?: string
}

export default function AddRentButton({
  locationId,
  children,
  size = 'default',
  variant = 'default',
  className,
}: AddRentButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const createMutation = useRentCreateMutation()

  const buildDefaults = (): CreateRentSchemaType =>
    ({
      locationId: locationId as number,
      isMonthly: true,
      startDate: undefined,
      endDate: undefined,
      month: undefined,
      year: undefined,
      amount: undefined as unknown as number,
      comment: undefined,
    }) as CreateRentSchemaType

  const form = useForm<CreateRentSchemaType>({
    resolver: zodResolver(CreateRentSchema),
    defaultValues: buildDefaults(),
  })

  const onSubmit = (values: CreateRentSchemaType) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        form.reset(buildDefaults())
        setDialogOpen(false)
      },
    })
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger render={<Button size={size} variant={variant} className={className} />}>
        {children ?? <Plus />}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить аренду</DialogTitle>
          <DialogDescription>Укажите локацию, период и сумму расхода</DialogDescription>
        </DialogHeader>
        <RentForm form={form} formId="create-rent-form" lockLocation={locationId !== undefined} />
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
