import * as z from 'zod'

const ManagerSalaryBaseSchema = z.object({
  userId: z.int().positive('Выберите менеджера'),
  monthlyAmount: z.int().nonnegative('Сумма не может быть отрицательной'),
  month: z.int().min(0).max(11).optional(),
  year: z.int().min(2000).max(2100).optional(),
  comment: z.string().max(200, 'Комментарий не должен превышать 200 символов').optional(),
})

const refineRange = (data: z.infer<typeof ManagerSalaryBaseSchema>, ctx: z.core.$RefinementCtx) => {
  if (data.month === undefined || data.month === null) {
    ctx.addIssue({ code: 'custom', path: ['month'], message: 'Укажите месяц' })
  }
  if (data.year === undefined || data.year === null) {
    ctx.addIssue({ code: 'custom', path: ['year'], message: 'Укажите год' })
  }
}

export const CreateManagerSalarySchema = ManagerSalaryBaseSchema.superRefine(refineRange)

export const UpdateManagerSalarySchema = ManagerSalaryBaseSchema.extend({
  id: z.int().positive(),
}).superRefine(refineRange)

export const DeleteManagerSalarySchema = z.object({
  id: z.int().positive(),
})

export const ManagerSalaryRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  userIds: z.array(z.number().int().positive()).optional(),
})

export type CreateManagerSalarySchemaType = z.infer<typeof CreateManagerSalarySchema>
export type UpdateManagerSalarySchemaType = z.infer<typeof UpdateManagerSalarySchema>
export type DeleteManagerSalarySchemaType = z.infer<typeof DeleteManagerSalarySchema>
export type ManagerSalaryRangeType = z.infer<typeof ManagerSalaryRangeSchema>
