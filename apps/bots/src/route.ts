/**
 * Контракт роута. Тело ответа всегда текст: VK ждёт `ok` или строку
 * подтверждения, MAX в тело не смотрит вовсе, а `/dispatch` читают глазами в
 * терминале — JSON тут не нужен никому.
 */
export type Reply = { status?: number; text: string }

export type RouteRequest = {
  body: string
  url: URL
  /** Заголовок по имени в нижнем регистре; node их так и отдаёт. */
  header: (name: string) => string | undefined
}
