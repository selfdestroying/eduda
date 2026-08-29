'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/dialog'
import { Loader, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useProductCreateMutation } from '../queries'
import {
  CreateProductSchema,
  type CreateProductInput,
  type CreateProductSchemaType,
} from '../schemas'
import ProductForm from './product-form'

export default function AddProductButton() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const createMutation = useProductCreateMutation()

  const form = useForm<CreateProductInput, unknown, CreateProductSchemaType>({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: {
      name: '',
      price: undefined,
      lessonCount: undefined,
      description: '',
      externalId: '',
      isActive: true,
    },
  })

  const onSubmit = (values: CreateProductSchemaType) => {
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
          <DialogTitle>Добавить продукт</DialogTitle>
          <DialogDescription>Новая строка прайс-листа школы</DialogDescription>
        </DialogHeader>
        <ProductForm form={form} formId="create-product-form" />
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
