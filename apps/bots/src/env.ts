/**
 * Переменные читаются один раз при старте и падают сразу, если чего-то нет:
 * бот без токена не «работает частично», он молча не отвечает — а это самый
 * дорогой вид поломки, потому что снаружи выглядит как «родитель не написал».
 *
 * `.env` подгружает сам node (`--env-file` в скриптах запуска), поэтому dotenv
 * здесь не нужен и переменные доступны до первого импорта `@repo/db`.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} не задан — без него бот работать не может`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 3006),

  /** Ключ крон-роута `/dispatch` — заголовок `X-Notify-Key`. */
  notifyKey: required('NOTIFY_KEY'),

  vk: {
    token: required('VK_GROUP_TOKEN'),
    /** Строка, которую VK ждёт в ответ на `type: 'confirmation'`. */
    confirmation: required('VK_CONFIRMATION'),
    /** Приезжает в теле каждого события Callback API. */
    secret: required('VK_SECRET'),
  },
}
