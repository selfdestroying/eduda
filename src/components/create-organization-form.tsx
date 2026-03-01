'use client'

import { Button } from '@/src/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { useOrganizationCreateMutation } from '@/src/data/organization/organization-create-mutation'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useMappedUserListQuery } from '../data/user/user-list-query'
import { CreateOrganizationSchema, CreateOrganizationSchemaType } from '../schemas/organization'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

interface CreateOrganizationFormProps {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function CreateOrganizationForm({ onSuccess, onError }: CreateOrganizationFormProps) {
  const createMutation = useOrganizationCreateMutation()
  const { data: users, isLoading: isUsersLoading } = useMappedUserListQuery()

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<CreateOrganizationSchemaType>({
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  })

  const nameValue = watch('name')

  // Auto-generate slug from name if slug hasn't been manually edited
  useEffect(() => {
    if (!dirtyFields.slug) {
      const generatedSlug = nameValue
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
      setValue('slug', generatedSlug)
    }
  }, [nameValue, dirtyFields.slug, setValue])

  const onSubmit = async (values: CreateOrganizationSchemaType) => {
    try {
      createMutation.mutate(
        {
          ownerId: values.owner.value,
          name: values.name,
          slug: values.slug,
        },
        {
          onSuccess: () => {
            onSuccess?.()
          },
          onError: (error) => {
            onError?.(error.message)
          },
        },
      )
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to process image')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="org-name">Organization Name</FieldLabel>
              <Input
                id="org-name"
                placeholder="My Organization"
                disabled={createMutation.isPending}
                {...field}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>
          )}
        />

        <Controller
          name="slug"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="org-slug">Organization Slug</FieldLabel>
              <Input
                id="org-slug"
                placeholder="my-organization"
                disabled={createMutation.isPending}
                {...field}
              />
              <FieldError>{errors.slug?.message}</FieldError>
            </Field>
          )}
        />

        <Controller
          name="owner"
          control={control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="owner-field">Владелец</FieldLabel>
              <Select
                items={users || []}
                disabled={isUsersLoading}
                name="owner-field"
                onValueChange={field.onChange}
              >
                <SelectTrigger aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Выберите владельца" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {users?.map((user) => (
                      <SelectItem key={user.value} value={user}>
                        {user.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : 'Create'}
        </Button>
      </FieldGroup>
    </form>
  )
}
