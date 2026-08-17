'use client'

import { Product } from '@repo/db'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/alert-dialog'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, MoreVertical, Pen, Trash } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useProductDeleteMutation, useProductUpdateMutation } from '../queries'
import { UpdateProductSchema, type UpdateProductSchemaType } from '../schemas'
import ProductForm from './product-form'

interface ProductActionsProps {
  product: Product
}

export default function ProductActions({ product }: ProductActionsProps) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const updateMutation = useProductUpdateMutation()
  const deleteMutation = useProductDeleteMutation()

  const form = useForm<UpdateProductSchemaType>({
    resolver: zodResolver(UpdateProductSchema),
    defaultValues: {
      id: product.id,
      name: product.name,
      price: product.price,
      lessonCount: product.lessonCount,
      description: product.description ?? '',
      isActive: product.isActive,
    },
  })

  const handleDelete = () => {
    deleteMutation.mutate({ id: product.id }, { onSuccess: () => setConfirmOpen(false) })
  }

  const onSubmit = (values: UpdateProductSchemaType) => {
    updateMutation.mutate(values, {
      onSuccess: () => {
        setEditDialogOpen(false)
        form.reset()
      },
    })
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreVertical />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-max">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                setEditDialogOpen(true)
                setOpen(false)
              }}
            >
              <Pen />
              Редактировать
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setConfirmOpen(true)
              setOpen(false)
            }}
          >
            <Trash />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать продукт</DialogTitle>
            <DialogDescription>Изменение продукта &ldquo;{product.name}&rdquo;</DialogDescription>
          </DialogHeader>
          <ProductForm form={form} formId="edit-product-form" />
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить продукт?</AlertDialogTitle>
            <AlertDialogDescription>
              Продукт &ldquo;{product.name}&rdquo; будет удалён. Прошлые оплаты сохранят название
              продукта, но ссылка на него сбросится — отчёты по продуктам их больше не увидят. Чтобы
              просто перестать его продавать, снимите его с продажи.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
            >
              {deleteMutation.isPending && <Loader className="animate-spin" />}
              Удалить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
