import { z } from 'zod'
import { ChargeableStatus } from '../chargeable'

export const RevenueFiltersSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  courseIds: z.array(z.number()).optional(),
  locationIds: z.array(z.number()).optional(),
  teacherIds: z.array(z.number()).optional(),
  chargeableStatuses: z.array(ChargeableStatus).min(1),
})

export type RevenueFilters = z.infer<typeof RevenueFiltersSchema>
