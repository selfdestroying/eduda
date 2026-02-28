import * as z from 'zod'
import { comboboxNumber } from './_primitives'

export const TransferStudentSchema = z.object({
  group: comboboxNumber('Выберите группу'),
})

export type TransferStudentSchemaType = z.infer<typeof TransferStudentSchema>
