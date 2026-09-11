import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Обратимое шифрование секретов в базе: AES-256-GCM, формат буфера
 * `nonce(12) || шифротекст || tag(16)`.
 *
 * Один код на два секрета с разными ключами: пароли учеников (платформа,
 * `STUDENT_PW_KEY`) и токены ботов школ (платформа и `apps/bots`,
 * `MAX_BOT_TOKEN_KEY`). Ключи разные намеренно: боту незачем уметь читать
 * пароли учеников.
 *
 * ponytail: ротации ключа нет — сменили ключ, старый шифротекст не читается.
 * Ротация = скрипт перешифровки старым ключом → новым; писать его до первой
 * ротации нечего.
 */

const ALGORITHM = 'aes-256-gcm'
const NONCE_LENGTH = 12
const TAG_LENGTH = 16

/**
 * Ключ из переменной окружения: 32 байта в base64. Читается при каждом вызове,
 * а не при импорте: модуль импортируют и там, где ключ не нужен вовсе.
 */
export function readSecretKey(name: string, purpose: string): Buffer {
  const raw = process.env[name]
  if (!raw) throw new Error(`${name} не задан — ${purpose}`)

  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error(`${name} должен быть 32 байта в base64`)
  return key
}

// Возвращается `Uint8Array`, а не `Buffer`: Prisma-поле `Bytes` типизировано
// как `Uint8Array<ArrayBuffer>`, а `Buffer` — это `Buffer<ArrayBufferLike>`.
export function encryptSecret(plain: string, key: Buffer): Uint8Array<ArrayBuffer> {
  const nonce = randomBytes(NONCE_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, nonce)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return Uint8Array.from(Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]))
}

/**
 * Бросает при неверном ключе и при повреждённом шифротексте. AES-GCM отвечает
 * на оба случая одинаково, различить их нельзя, поэтому понятный текст ошибки —
 * забота вызывающего: он знает, что именно не расшифровалось.
 */
export function decryptSecret(enc: Uint8Array, key: Buffer): string {
  const buffer = Buffer.from(enc)
  if (buffer.length <= NONCE_LENGTH + TAG_LENGTH) throw new Error('Повреждённый шифротекст')

  const decipher = createDecipheriv(ALGORITHM, key, buffer.subarray(0, NONCE_LENGTH))
  decipher.setAuthTag(buffer.subarray(buffer.length - TAG_LENGTH))

  return Buffer.concat([
    decipher.update(buffer.subarray(NONCE_LENGTH, buffer.length - TAG_LENGTH)),
    decipher.final(),
  ]).toString('utf8')
}
