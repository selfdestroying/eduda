import * as z from 'zod'
import { comboboxNumber } from './_primitives'

export const CreateAttendanceSchema = z.object({
  target: comboboxNumber('Выберите значение'),
  studentStatus: z.enum(['ACTIVE', 'TRIAL'], 'Выберите статус ученика'),
})

export type CreateAttendanceSchemaType = z.infer<typeof CreateAttendanceSchema>
