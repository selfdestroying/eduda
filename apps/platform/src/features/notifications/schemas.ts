import { z } from 'zod'

/**
 * Токен кабинета родителя (`Parent.accessToken`) — он же ключ доступа сюда.
 * Форма проверяется до запроса: колонка в базе типа `uuid`, и Postgres падает
 * на любой другой строке, а токен приходит из адреса.
 */
const TokenSchema = z.string().uuid()

export const CabinetMessengersSchema = z.object({
  token: TokenSchema,
})

export const DisconnectMessengerSchema = z.object({
  token: TokenSchema,
  provider: z.enum(['VK', 'MAX']),
})

export type CabinetMessengersSchemaType = z.infer<typeof CabinetMessengersSchema>
export type DisconnectMessengerSchemaType = z.infer<typeof DisconnectMessengerSchema>
