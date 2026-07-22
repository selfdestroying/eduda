import * as z from 'zod'

export const DASHBOARD_MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export const DashboardMonthKeySchema = z
  .string()
  .regex(DASHBOARD_MONTH_KEY_REGEX, 'Укажите месяц в формате YYYY-MM')

export const GetDashboardMonthDataSchema = z.object({
  month: DashboardMonthKeySchema,
})

export type GetDashboardMonthDataSchemaType = z.infer<typeof GetDashboardMonthDataSchema>
