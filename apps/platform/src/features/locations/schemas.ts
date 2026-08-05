import * as z from 'zod'

export const LocationBaseSchema = z.object({
  name: z
    .string('Введите название локации')
    .min(2, 'Название должно содержать не менее 2 символов')
    .max(50, 'Название не должно превышать 50 символов'),
})

export const CreateLocationSchema = LocationBaseSchema

export const UpdateLocationSchema = LocationBaseSchema.partial().extend({
  id: z.int().positive(),
})

export const DeleteLocationSchema = z.object({
  id: z.int().positive(),
})

export type CreateLocationSchemaType = z.infer<typeof CreateLocationSchema>
export type UpdateLocationSchemaType = z.infer<typeof UpdateLocationSchema>
export type DeleteLocationSchemaType = z.infer<typeof DeleteLocationSchema>
