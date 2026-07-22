'use client'

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
import { Archive, ArchiveRestore, Loader, MoreVertical, Pen } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMappedCategoryListQuery } from '../../categories/queries'
import {
  useProductArchiveMutation,
  useProductRestoreMutation,
  useProductUpdateMutation,
} from '../queries'
import { UpdateProductSchema, UpdateProductSchemaType } from '../schemas'
import { ProductWithCategory } from '../types'
import ProductForm from './product-form'

interface ProductActionsProps {
  product: ProductWithCategory
}

export default function ProductActions({ product }: ProductActionsProps) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const { data: categories = [] } = useMappedCategoryListQuery()

  const updateMutation = useProductUpdateMutation()
  const archiveMutation = useProductArchiveMutation()
  const restoreMutation = useProductRestoreMutation()
  const isArchived = product.archivedAt !== null

  const form = useForm<UpdateProductSchemaType>({
    resolver: zodResolver(UpdateProductSchema),
    defaultValues: {
      id: product.id,
      name: product.name,
      price: product.price,
      description: product.description || undefined,
      quantity: product.quantity,
      categoryId: product.categoryId,
      image: undefined,
    },
  })

  const handleArchive = () => {
    archiveMutation.mutate({ id: product.id }, { onSuccess: () => setConfirmOpen(false) })
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
          {isArchived ? (
            <DropdownMenuItem
              disabled={restoreMutation.isPending}
              onClick={() => {
                restoreMutation.mutate({ id: product.id })
                setOpen(false)
              }}
            >
              <ArchiveRestore />
              Вернуть в каталог
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => {
                setConfirmOpen(true)
                setOpen(false)
              }}
            >
              <Archive />
              Архивировать
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Убрать товар из каталога?</AlertDialogTitle>
            <AlertDialogDescription>
              Ученики перестанут его видеть, но он останется в истории заказов — коины за него уже
              списаны. Товар можно вернуть в каталог в любой момент.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <Button disabled={archiveMutation.isPending} onClick={handleArchive}>
              {archiveMutation.isPending ? <Loader className="animate-spin" /> : 'Архивировать'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать товар</DialogTitle>
            <DialogDescription>Обновите информацию о товаре</DialogDescription>
          </DialogHeader>
          <ProductForm
            form={form}
            formId="edit-product-form"
            categories={categories}
            existingImageUrl={product.imageUrl}
          />
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
    </>
  )
}
