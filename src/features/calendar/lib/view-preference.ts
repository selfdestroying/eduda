/**
 * Выбор главной страницы на время миграции с панели управления на календарь.
 * Пока кука установлена, `/` редиректит на `/calendar` (см. src/app/[slug]/page.tsx).
 */

export const HOME_VIEW_COOKIE = 'home_view'
export const HOME_VIEW_CALENDAR = 'calendar'

const HOME_VIEW_MAX_AGE = 60 * 60 * 24 * 365

/** Запомнить выбор «новый вид»: главная страница открывает календарь. */
export function enableCalendarHomeView() {
  document.cookie = `${HOME_VIEW_COOKIE}=${HOME_VIEW_CALENDAR}; path=/; max-age=${HOME_VIEW_MAX_AGE}`
}

/** Вернуть классическую панель управления на главной. */
export function disableCalendarHomeView() {
  document.cookie = `${HOME_VIEW_COOKIE}=; path=/; max-age=0`
}

/** Активен ли новый вид. Только для клиента (читает document.cookie). */
export function isCalendarHomeView() {
  return document.cookie.split('; ').includes(`${HOME_VIEW_COOKIE}=${HOME_VIEW_CALENDAR}`)
}
