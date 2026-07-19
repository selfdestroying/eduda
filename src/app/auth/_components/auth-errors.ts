/**
 * better-auth отдаёт сообщения на английском, поэтому переводим по коду ошибки.
 * Неверные учётные данные намеренно описаны обобщённо: иначе по разнице
 * формулировок можно перебором выяснить, какие email зарегистрированы.
 *
 * По той же причине отдельной проверки «занят ли email» перед регистрацией нет —
 * `signUp.email` сам вернёт `USER_ALREADY_EXISTS`. Учти: если когда-нибудь
 * включить `requireEmailVerification` или `autoSignIn: false`, better-auth
 * начнёт отдавать 200 в обоих случаях (антиэнумерация) и этот код перестанет
 * приходить — тогда форму регистрации надо будет переводить на «мы отправили
 * письмо».
 */
export const authErrorMessages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Неверный email или пароль',
  INVALID_PASSWORD: 'Неверный email или пароль',
  USER_EMAIL_NOT_FOUND: 'Неверный email или пароль',
  INVALID_EMAIL: 'Некорректный email',
  EMAIL_NOT_VERIFIED: 'Email не подтверждён',
  FAILED_TO_CREATE_SESSION: 'Не удалось создать сессию. Попробуйте ещё раз.',
  // Фактический код от better-auth 1.6 — длинный. Короткий оставлен на случай
  // расхождения между версиями.
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Этот email уже зарегистрирован',
  USER_ALREADY_EXISTS: 'Этот email уже зарегистрирован',
}

export const FALLBACK_ERROR = 'Сервис временно недоступен. Попробуйте позже.'

const RATE_LIMITED = 'Слишком много попыток. Подождите немного и попробуйте снова.'

/**
 * Сообщение для тоста. Английский `error.message` намеренно не показываем:
 * better-auth отвечает по-английски, а UI у нас русский — незнакомый код
 * логируем и отдаём общий текст, вместо того чтобы показать «Too many requests».
 *
 * На необработанной ошибке (например, недоступна БД) better-call отдаёт 500 с
 * пустым телом — `new Response(null, ...)`, поэтому и code, и message здесь
 * пустые, хотя тип обещает строку.
 */
export function authErrorMessage(error: {
  code?: string
  message?: string
  status?: number
}): string {
  const code = typeof error.code === 'string' ? error.code : ''
  const known = authErrorMessages[code]
  if (known) return known
  if (error.status === 429) return RATE_LIMITED
  if (code || error.message) {
    console.error('auth: непереведённая ошибка', { code, message: error.message })
  }
  return FALLBACK_ERROR
}
