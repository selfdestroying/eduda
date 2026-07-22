import * as z from 'zod'

export const ReturnToGroupSchema = z.object({
  groupId: z.number().int().positive(),
  studentId: z.number().int().positive(),
})

export type ReturnToGroupSchemaType = z.infer<typeof ReturnToGroupSchema>
