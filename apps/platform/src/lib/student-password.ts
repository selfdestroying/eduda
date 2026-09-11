import { decryptSecret, encryptSecret, readSecretKey } from '@repo/core/secret-box'

/**
 * Обратимое хранение паролей учеников.
 *
 * Хеш для входа лежит в `StudentCredential.password` (better-auth), но школа
 * обязана видеть пароль ученика в карточке — хеш этого не даёт by design.
 * Поэтому рядом, в `StudentAccount.passwordEnc`, лежит AES-256-GCM шифротекст
 * (`@repo/core/secret-box`). Ученик пароль не меняет, так что две копии не могут
 * разойтись.
 */

const key = () => readSecretKey('STUDENT_PW_KEY', 'пароли учеников недоступны')

export function encryptStudentPassword(plain: string): Uint8Array<ArrayBuffer> {
  return encryptSecret(plain, key())
}

/** Бросает при неверном ключе или повреждённом шифротексте. */
export function decryptStudentPassword(enc: Uint8Array): string {
  const secret = key()

  try {
    return decryptSecret(enc, secret)
  } catch {
    // AES-GCM отвечает одинаково и на чужой ключ, и на испорченные байты
    // («Unsupported state or unable to authenticate data»), различить их нельзя.
    // Называем обе причины сами: иначе менеджер видит английскую крипто-ошибку
    // и не понимает, что делать. Вход ученика при этом не затронут — он идёт
    // по хешу better-auth, а не по этому шифротексту.
    throw new Error(
      'Не удалось расшифровать пароль: STUDENT_PW_KEY не тот, которым он был зашифрован, ' +
        'либо запись повреждена. Вход ученика это не затрагивает — перевыпустите пароль.',
    )
  }
}
