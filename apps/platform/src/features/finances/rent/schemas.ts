import * as z from 'zod'

const RentCommonSchema = z.object({
  locationId: z.int().positive('Выберите локацию'),
  amount: z.int().positive('Сумма должна быть больше 0'),
  comment: z.string().max(200, 'Комментарий не должен превышать 200 символов').optional(),
  isMonthly: z.boolean(),
  // Range mode
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  // Monthly mode (start month/year of the recurring contract)
  month: z.int().min(0).max(11).optional(),
  year: z.int().min(2000).max(2100).optional(),
})

const rentPeriodRefine = (data: z.infer<typeof RentCommonSchema>, ctx: z.core.$RefinementCtx) => {
  if (data.isMonthly) {
    if (data.month === undefined || data.month === null) {
      ctx.addIssue({ code: 'custom', path: ['month'], message: 'Укажите месяц' })
    }
    if (data.year === undefined || data.year === null) {
      ctx.addIssue({ code: 'custom', path: ['year'], message: 'Укажите год' })
    }
  } else {
    if (!data.startDate) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Укажите дату начала' })
    }
    if (!data.endDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Укажите дату окончания' })
    }
    if (
      data.startDate &&
      data.endDate &&
      new Date(data.startDate).getTime() > new Date(data.endDate).getTime()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Дата окончания должна быть не раньше даты начала',
      })
    }
  }
}

export const RentBaseSchema = RentCommonSchema

export const CreateRentSchema = RentCommonSchema.superRefine(rentPeriodRefine)

export const UpdateRentSchema = RentCommonSchema.extend({
  id: z.int().positive(),
}).superRefine(rentPeriodRefine)

export const DeleteRentSchema = z.object({
  id: z.int().positive(),
})

export type CreateRentSchemaType = z.infer<typeof CreateRentSchema>
export type UpdateRentSchemaType = z.infer<typeof UpdateRentSchema>
export type DeleteRentSchemaType = z.infer<typeof DeleteRentSchema>
