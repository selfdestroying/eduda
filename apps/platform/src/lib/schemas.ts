import * as z from 'zod'

/**
 * Необязательная ссылка из формы. Пустое поле (и поле из одних пробелов) — это
 * «ссылки нет», то есть `null`, а не ошибка валидации: текстовый input отдаёт
 * `''`, и без этого очистить необязательное поле нельзя было бы вовсе.
 *
 * Именно `null`, а не `undefined`: ключ со значением `undefined` Prisma в
 * `update` просто пропускает, и старая ссылка осталась бы в базе.
 */
export const OptionalUrlSchema = z
  .string()
  .nullish()
  .transform((v) => v?.trim() || null)
  .pipe(z.url('Неверный URL').nullable())
  .optional()
