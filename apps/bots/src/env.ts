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

const maxToken = process.env.MAX_BOT_TOKEN

export const env = {
  port: Number(process.env.PORT ?? 3006),

  /** Ключ крон-роута `/dispatch` — заголовок `X-Notify-Key`. */
  notifyKey: required('NOTIFY_KEY'),

  /**
   * Адрес платформы — нужен ровно для одной ссылки: кабинета родителя.
   * Установка одна на все школы, поэтому дефолт боевой, а не обязательная
   * переменная, без которой бот не поднимется.
   */
  platformUrl: (process.env.PLATFORM_URL ?? 'https://eduda.online').replace(/\/+$/, ''),

  vk: {
    token: required('VK_GROUP_TOKEN'),
    /** Строка, которую VK ждёт в ответ на `type: 'confirmation'`. */
    confirmation: required('VK_CONFIRMATION'),
    /** Приезжает в теле каждого события Callback API. */
    secret: required('VK_SECRET'),
  },

  /**
   * MAX-половина включается только вместе с токеном, и это не лень, а условие
   * задачи: публикация бота в MAX требует верифицированного юрлица РФ, и до
   * неё установка работает как VK-only. Обязательные переменные уронили бы
   * рабочий VK-контур ради половины, которую ещё нельзя завести.
   *
   * Без токена: роут `/max` отвечает 503, подписка не оформляется, провайдер
   * не регистрируется в дренаже.
   */
  max: maxToken
    ? {
        token: maxToken,
        /** Куда MAX шлёт события. Он же — ключ подписки при переоформлении. */
        webhookUrl: required('MAX_WEBHOOK_URL'),
        /** Приезжает в заголовке `X-Max-Bot-Api-Secret`. */
        secret: required('MAX_WEBHOOK_SECRET'),
      }
    : null,
}

/**
 * Личный кабинет родителя. Тот же адрес школа копирует из карточки родителя.
 *
 * Кабинет живёт на поддомене `parent.`, а второй переменной под него нет: она
 * отличалась бы от `PLATFORM_URL` ровно одним словом, и разошлись бы они молча
 * — на локальной машине или на стенде, где домен другой.
 */
export function cabinetUrl(accessToken: string): string {
  return `${env.platformUrl.replace('://', '://parent.')}/${accessToken}`
}
