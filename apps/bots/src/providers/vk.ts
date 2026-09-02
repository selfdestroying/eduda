import { env } from '../env'

/**
 * Ответ провайдера в форме, которая нужна дренажу очереди: не «получилось или
 * нет», а «стоит ли пробовать снова и не отписался ли родитель».
 */
export type SendResult =
  | { ok: true }
  | { ok: false; retryable: boolean; blocked?: boolean; error: string }

const API = 'https://api.vk.com/method/messages.send'

/** Версия API, в которой уже есть `payload` у кнопок и меток ссылок. */
const VERSION = '5.199'

/**
 * Коды VK, после которых пробовать снова бессмысленно, но и виноватых нет:
 * 901 — родитель запретил сообщения от сообщества. Это не ошибка доставки, а
 * отписка, поэтому дренаж по нему гасит привязку.
 */
const MESSAGES_DENY_SEND = 901

/** Слишком часто, флуд-контроль, внутренняя ошибка — пройдёт само. */
const RETRYABLE_CODES = new Set([1, 6, 9, 10])

/**
 * `randomId` — ключ идемпотентности на стороне VK: с одинаковым значением
 * второе сообщение не создастся. Для строк очереди сюда идёт её `id`, поэтому
 * ретрай после таймаута не задваивает сообщение. Для ответов бота в диалоге
 * ключа нет, и там честнее время: два одинаковых ответа подряд безвредны.
 */
export async function sendMessage(
  externalId: string,
  text: string,
  randomId: number = Date.now(),
): Promise<SendResult> {
  const body = new URLSearchParams({
    access_token: env.vk.token,
    v: VERSION,
    user_id: externalId,
    random_id: String(randomId),
    message: text,
  })

  let response: Response
  try {
    response = await fetch(API, {
      method: 'POST',
      body,
      // Вебхук VK ждёт ответа около трёх секунд, и отправка иногда идёт из
      // обработчика — вешаться на молчащем сокете здесь нельзя.
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    return { ok: false, retryable: true, error: `сеть: ${String(error)}` }
  }

  if (!response.ok) {
    // 5xx у VK — это VK, а не мы.
    return {
      ok: false,
      retryable: response.status >= 500,
      error: `HTTP ${response.status}`,
    }
  }

  const data = (await response.json()) as {
    error?: { error_code: number; error_msg: string }
  }

  if (data.error) {
    const { error_code: code, error_msg: message } = data.error
    return {
      ok: false,
      retryable: RETRYABLE_CODES.has(code),
      blocked: code === MESSAGES_DENY_SEND,
      error: `VK ${code}: ${message}`,
    }
  }

  return { ok: true }
}
