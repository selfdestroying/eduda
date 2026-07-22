import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Обратимое хранение паролей учеников.
 *
 * Хеш для входа лежит в `StudentCredential.password` (better-auth), но школа
 * обязана видеть пароль ученика в карточке — хеш этого не даёт by design.
 * Поэтому рядом, в `StudentAccount.passwordEnc`, лежит AES-256-GCM шифротекст.
 * Ученик пароль не меняет, так что две копии не могут разойтись.
 *
 * Формат буфера: `nonce(12) || ciphertext || tag(16)`.
 *
 * ponytail: ключ один, ротации нет — при смене `STUDENT_PW_KEY` старый
 * шифротекст перестанет читаться (вход по хешу продолжит работать). Ротация =
 * скрипт перешифровки старым ключом → новым, писать его до первой ротации нечего.
 */

const ALGORITHM = 'aes-256-gcm'
const NONCE_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env.STUDENT_PW_KEY
  if (!raw) {
    throw new Error('STUDENT_PW_KEY не задан — пароли учеников недоступны')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('STUDENT_PW_KEY должен быть 32 байта в base64')
  }
  return key
}

// Возвращается `Uint8Array`, а не `Buffer`: Prisma-поле `Bytes` типизировано
// как `Uint8Array<ArrayBuffer>`, а `Buffer` — это `Buffer<ArrayBufferLike>`.
export function encryptStudentPassword(plain: string): Uint8Array<ArrayBuffer> {
  const nonce = randomBytes(NONCE_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), nonce)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return Uint8Array.from(Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]))
}

/** Бросает при неверном ключе или повреждённом шифротексте. */
export function decryptStudentPassword(enc: Uint8Array): string {
  const buffer = Buffer.from(enc)
  if (buffer.length <= NONCE_LENGTH + TAG_LENGTH) {
    throw new Error('Повреждённый шифротекст пароля')
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), buffer.subarray(0, NONCE_LENGTH))
  decipher.setAuthTag(buffer.subarray(buffer.length - TAG_LENGTH))
  return Buffer.concat([
    decipher.update(buffer.subarray(NONCE_LENGTH, buffer.length - TAG_LENGTH)),
    decipher.final(),
  ]).toString('utf8')
}
