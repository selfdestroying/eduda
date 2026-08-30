import * as z from 'zod'

export const ProfitMonthlyFiltersSchema = z.object({
  year: z.int().min(2000).max(2100),
})

export type ProfitMonthlyFilters = z.infer<typeof ProfitMonthlyFiltersSchema>
