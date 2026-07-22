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
import { useMappedCategoryListQuery } from '../../categories/queries'
import { useProductCreateMutation } from '../queries'
import { CreateProductSchema, CreateProductSchemaType } from '../schemas'
import ProductForm from './product-form'

export default function AddProductButton() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: categories = [] } = useMappedCategoryListQuery()
  const createMutation = useProductCreateMutation()

  const form = useForm<CreateProductSchemaType>({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: {
      name: undefined,
      categoryId: undefined,
      price: undefined,
      description: undefined,
      quantity: undefined,
      image: undefined,
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
          <DialogDescription>Создайте новый продукт</DialogDescription>
        </DialogHeader>
        <ProductForm form={form} formId="create-product-form" categories={categories} />
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
