import * as z from 'zod'

export const SnoozeAlertSchema = z.object({
  entityId: z.int().min(1),
  entityKey: z.string().min(1),
  snoozeDays: z.int().min(1).max(30).default(2),
})

export type SnoozeAlertSchemaType = z.infer<typeof SnoozeAlertSchema>

export const RestoreSnoozedAlertSchema = z.object({
  entityId: z.int().min(1),
  entityKey: z.string().min(1),
})

export type RestoreSnoozedAlertSchemaType = z.infer<typeof RestoreSnoozedAlertSchema>

export const RestoreSnoozedAlertsBulkSchema = z.object({
  alerts: z
    .array(
      z.object({
        entityId: z.int().min(1),
        entityKey: z.string().min(1),
      }),
    )
    .min(1),
})

export type RestoreSnoozedAlertsBulkSchemaType = z.infer<typeof RestoreSnoozedAlertsBulkSchema>

export const SnoozeAlertsBulkSchema = z.object({
  alerts: z
    .array(
      z.object({
        entityId: z.int().min(1),
        entityKey: z.string().min(1),
      }),
    )
    .min(1),
  snoozeDays: z.int().min(1).max(30).default(2),
})

export type SnoozeAlertsBulkSchemaType = z.infer<typeof SnoozeAlertsBulkSchema>
