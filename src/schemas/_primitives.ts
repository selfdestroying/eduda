import * as z from 'zod'
import { normalizeDateOnly } from '../lib/timezone'

// ─── Combobox ───────────────────────────────────────────────────────
// Единый тип для combobox-полей в формах. value — всегда string,
// при необходимости парсить в number через Number() на месте.

export const ComboboxItemSchema = z.object({
  label: z.string(),
  value: z.string(),
})

/**
 * Создаёт combobox-схему с кастомным error message.
 * value — string (для SelectItem и combobox, где ID передаётся строкой).
 */
export const combobox = (error: string) => z.object({ label: z.string(), value: z.string() }, error)

/**
 * Создаёт combobox-схему с числовым value и кастомным error message.
 * value — number (для случаев, где ID передаётся числом).
 */
export const comboboxNumber = (error: string) =>
  z.object({ label: z.string(), value: z.number() }, error)

export type ComboboxItem = z.infer<typeof ComboboxItemSchema>

// ─── Date ───────────────────────────────────────────────────────────
// Приводит Date из браузерного календаря к нормализованному виду (date-only).

export const DateOnlySchema = z.date().transform(normalizeDateOnly)

// ─── URL (optional) ────────────────────────────────────────────────
// URL-поле, допускающее пустую строку и undefined.

export const OptionalUrlSchema = z
  .string()
  .url('Укажите корректный URL')
  .optional()
  .or(z.literal(''))
