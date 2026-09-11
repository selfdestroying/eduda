import type { Prisma } from '@repo/db'
import { decryptSecret, encryptSecret, readSecretKey } from './secret-box'

/**
 * Токены собственных ботов MAX школ.
 *
 * Шифруются на подключении (платформа), расшифровываются там, где от имени бота
 * говорят: при отправке и приёме событий (`apps/bots`) и при входе в
 * мини-приложение (платформа). Ключ `MAX_BOT_TOKEN_KEY` один на обе стороны и
 * отдельный от ключа паролей учеников.
 *
 * Отдельно от `messenger.ts`, потому что тянет `node:crypto`: отборы привязок
 * оттуда читают и модули, которые лежат рядом с клиентским кодом.
 */

const tokenKey = () => readSecretKey('MAX_BOT_TOKEN_KEY', 'токены ботов школ недоступны')

export function encryptBotToken(token: string): Uint8Array<ArrayBuffer> {
  return encryptSecret(token, tokenKey())
}

export type SchoolBotToken = { organizationId: number; token: string }

/**
 * Расшифрованные токены ботов школ — всех или одной. Токен, который не читается,
 * пропускается с записью в лог: из-за одной школы не должны замолчать остальные.
 */
export async function readSchoolBotTokens(
  db: Prisma.TransactionClient,
  where: { organizationId?: number } = {},
): Promise<SchoolBotToken[]> {
  const rows = await db.organizationMaxBot.findMany({
    where,
    select: { organizationId: true, tokenEnc: true },
    orderBy: { organizationId: 'asc' },
  })
  if (rows.length === 0) return []

  let key: Buffer
  try {
    key = tokenKey()
  } catch (error) {
    console.error(`max: ${String(error)}`)
    return []
  }

  return rows.flatMap((row) => {
    try {
      return [{ organizationId: row.organizationId, token: decryptSecret(row.tokenEnc, key) }]
    } catch {
      console.error(
        `max: токен бота школы ${row.organizationId} не расшифровался — ` +
          'MAX_BOT_TOKEN_KEY не тот, которым он зашифрован, либо запись повреждена',
      )
      return []
    }
  })
}
