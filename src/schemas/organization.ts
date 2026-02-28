import * as z from 'zod'
import { combobox } from './_primitives'

export const CreateOrganizationSchema = z.object({
  owner: combobox('Укажите владельца'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
})

export type CreateOrganizationSchemaType = z.infer<typeof CreateOrganizationSchema>
