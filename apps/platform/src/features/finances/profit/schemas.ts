import * as z from 'zod'

export const ProfitFiltersSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
})

export type ProfitFilters = z.infer<typeof ProfitFiltersSchema>

export const ProfitMonthlyFiltersSchema = z.object({
  year: z.int().min(2000).max(2100),
})

export type ProfitMonthlyFilters = z.infer<typeof ProfitMonthlyFiltersSchema>
