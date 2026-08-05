import { z } from 'zod'

export const GlobalSearchSchema = z.object({
  query: z.string().trim().min(2, 'Минимум 2 символа'),
})

export type GlobalSearchSchemaType = z.infer<typeof GlobalSearchSchema>
