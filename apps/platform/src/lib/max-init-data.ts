import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Проверка данных запуска мини-приложения MAX (`window.WebApp.initData`).
 *
 * Строку отдаёт клиентская библиотека MAX, то есть приходит она из браузера и
 * сама по себе ничего не доказывает. Доказывает подпись: она сделана токеном
 * бота, которого у страницы нет, поэтому сошедшийся хеш — единственное, что
 * позволяет верить `user.id` внутри и отдавать по нему кабинет.
 *
 * Рецепт из документации слово в слово: секрет — это подпись токена бота ключом
 * «WebAppData», хеш — подпись пар `ключ=значение`, отсортированных по имени
 * ключа и склеенных переводом строки. Всё считается локально, к MAX по сети
 * ходить не надо — российский корневой сертификат здесь ни при чём.
 */

export type MaxLaunchUser = { id: string; firstName: string | null }

export type MaxInitData = { ok: true; user: MaxLaunchUser } | { ok: false; reason: string }

/**
 * Срок годности `auth_date`. Час: строку выдают в момент запуска приложения, и
 * первое, что оно делает, — идёт с ней сюда. Ограничение нужно, чтобы утёкшая
 * строка не открывала кабинет вечно; в документации его нет, поэтому наш.
 */
const MAX_AGE_SECONDS = 60 * 60

export function verifyInitData(
  initData: string,
  botToken: string,
  now: number = Date.now(),
): MaxInitData {
  const params = new Map<string, string>()
  let signature: string | null = null

  for (const chunk of initData.split('&')) {
    if (!chunk) continue

    const eq = chunk.indexOf('=')
    if (eq < 0) return { ok: false, reason: 'строка запуска испорчена' }

    const key = chunk.slice(0, eq)
    let value: string
    try {
      value = decodeURIComponent(chunk.slice(eq + 1))
    } catch {
      return { ok: false, reason: 'строка запуска испорчена' }
    }

    // Хеш в подписываемый набор не входит — он и есть подпись.
    if (key === 'hash') {
      if (signature !== null) return { ok: false, reason: 'в строке запуска две подписи' }
      signature = value
      continue
    }

    params.set(key, value)
  }

  if (signature === null) return { ok: false, reason: 'в строке запуска нет подписи' }

  // Сортировка по коду символа, а не `localeCompare`: тот зависит от локали
  // процесса, и на другой машине порядок вышел бы другим.
  const launchParams = [...params]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secret).update(launchParams).digest('hex')

  if (!equalHex(expected, signature)) return { ok: false, reason: 'подпись не сошлась' }

  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate)) return { ok: false, reason: 'в строке запуска нет времени' }
  if (Math.abs(now / 1000 - authDate) > MAX_AGE_SECONDS) {
    return { ok: false, reason: 'строка запуска устарела' }
  }

  return parseUser(params.get('user'))
}

/** `user` приезжает одним параметром — JSON внутри строки, как у Telegram. */
function parseUser(raw: string | undefined): MaxInitData {
  if (!raw) return { ok: false, reason: 'в строке запуска нет пользователя' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'пользователь в строке запуска не разобрался' }
  }

  const user = parsed as { id?: unknown; first_name?: unknown }
  // Идентификатор храним строкой — как `ParentMessenger.externalId`: диапазоны
  // у VK и MAX разные, а арифметики над ними нет.
  const id = typeof user.id === 'number' || typeof user.id === 'string' ? String(user.id) : ''
  if (!id) return { ok: false, reason: 'у пользователя в строке запуска нет id' }

  return {
    ok: true,
    user: { id, firstName: typeof user.first_name === 'string' ? user.first_name : null },
  }
}

/** Побайтовое сравнение постоянного времени: подпись сверяют с чужой строкой. */
function equalHex(expected: string, received: string): boolean {
  const left = Buffer.from(expected, 'hex')
  const right = Buffer.from(received, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}
