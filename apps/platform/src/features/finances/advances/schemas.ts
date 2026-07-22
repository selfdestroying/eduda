import { z } from 'zod'
import { ChargeableStatus } from '../chargeable'

export const AdvancesFiltersSchema = z.object({
  /** ISO-строка начала периода */
  startDate: z.string(),
  /** ISO-строка конца периода */
  endDate: z.string(),
  chargeableStatuses: z.array(ChargeableStatus).min(1),
})

export type AdvancesFilters = z.infer<typeof AdvancesFiltersSchema>
