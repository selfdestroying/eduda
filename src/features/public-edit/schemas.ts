import { normalizeDateOnly } from '@/src/lib/timezone'
import * as z from 'zod'

// ─── Token ──────────────────────────────────────────────────────────
// Токен теперь принадлежит родителю (Parent.accessToken).

export const TokenSchema = z.string().uuid()

const StudentIdSchema = z.number().int().positive()

// ─── Helpers ────────────────────────────────────────────────────────

const NullableTextSchema = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))

const BirthDateSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null

    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Некорректная дата рождения' })
      return z.NEVER
    }

    return normalizeDateOnly(date)
  })

const PhoneSchema = NullableTextSchema.pipe(
  z
    .string()
    .regex(/^\+?[0-9\s\-()]{7,15}$/)
    .nullable(),
)

const EmailSchema = NullableTextSchema.pipe(z.string().email().nullable())

// ─── Read schemas ───────────────────────────────────────────────────

/** Только токен — данные кабинета (родитель + список детей). */
export const PublicTokenSchema = z.object({
  token: TokenSchema,
})

/** Токен + (опционально) выбранный ребёнок — read-данные ребёнка. */
export const PublicChildSchema = z.object({
  token: TokenSchema,
  studentId: StudentIdSchema.optional(),
})

// ─── Own parent (запись токена) ─────────────────────────────────────

export const UpdateOwnParentSchema = z.object({
  token: TokenSchema,
  firstName: z.string().trim().min(2),
  lastName: NullableTextSchema.pipe(z.string().min(2).nullable()),
  phone: PhoneSchema,
  email: EmailSchema,
})

// ─── Student input ──────────────────────────────────────────────────

export const UpdatePublicStudentSchema = z.object({
  token: TokenSchema,
  studentId: StudentIdSchema,
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  birthDate: BirthDateSchema,
})

// ─── Parent input ───────────────────────────────────────────────────

export const UpdatePublicParentSchema = z.object({
  token: TokenSchema,
  studentId: StudentIdSchema,
  parentId: z.number().int().positive(),
  firstName: z.string().trim().min(2),
  lastName: NullableTextSchema.pipe(z.string().min(2).nullable()),
  phone: PhoneSchema,
  email: EmailSchema,
})

export const CreatePublicParentSchema = z.object({
  token: TokenSchema,
  studentId: StudentIdSchema,
  firstName: z.string().trim().min(2),
  lastName: NullableTextSchema.pipe(z.string().min(2).nullable()),
  phone: PhoneSchema,
  email: EmailSchema,
})

// ─── Confirm actuality ──────────────────────────────────────────────

export const ConfirmPublicActualitySchema = z.object({
  token: TokenSchema,
  studentId: StudentIdSchema,
})

// ─── Inferred types ─────────────────────────────────────────────────

export type PublicTokenSchemaType = z.input<typeof PublicTokenSchema>
export type PublicChildSchemaType = z.input<typeof PublicChildSchema>
export type UpdateOwnParentSchemaType = z.input<typeof UpdateOwnParentSchema>
export type UpdatePublicStudentSchemaType = z.input<typeof UpdatePublicStudentSchema>
export type UpdatePublicParentSchemaType = z.input<typeof UpdatePublicParentSchema>
export type CreatePublicParentSchemaType = z.input<typeof CreatePublicParentSchema>
export type ConfirmPublicActualitySchemaType = z.input<typeof ConfirmPublicActualitySchema>
