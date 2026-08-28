import type { Period } from '@/src/hooks/use-table-state'
import { dateToYmd, ymdToLocalDate } from '@/src/lib/timezone'
import { addDays, addMonths, endOfMonth, format, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'

/** Разрез времени, по которому график складывает дни в столбики. */
export type View = 'week' | 'month' | 'year'

export const VIEW_LABEL: Record<View, string> = { week: 'Неделя', month: 'Месяц', year: 'Год' }

/**
 * Сколько корзин помещается в столбики читаемой ширины. За всю историю их
 * набирается под сотню, и на телефоне каждой достаётся два-три пикселя.
 *
 * Показываем хвост — свежие периоды, за которыми к графику и приходят. Старое
 * никуда не девается: его достают периодом в тулбаре или разрезом покрупнее.
 */
export const MAX_BUCKETS = { mobile: 8, desktop: 26 }

/**
 * Куда проваливаться по клику. Год показывает месяцы, месяц — недели, неделя
 * остаётся собой: дробить её на дни график не умеет, да и незачем — с недельным
 * периодом всё видно в таблице под ним.
 */
export const NEXT_VIEW: Record<View, View> = { year: 'month', month: 'week', week: 'week' }

/**
 * Ключ корзины. Год и месяц — префиксы даты: `YYYY-MM-DD` отрезается без разбора.
 * Неделя так не берётся, поэтому ключ — её понедельник, тоже `YYYY-MM-DD`.
 *
 * Ключи всех трёх видов упорядочены лексикографически так же, как хронологически,
 * и монотонны по дате — значит корзины ложатся в Map в порядке прихода точек, и
 * сортировать их отдельно не нужно.
 */
export function bucketKey(date: string, view: View) {
  if (view === 'year') return date.slice(0, 4)
  if (view === 'month') return date.slice(0, 7)
  return format(startOfWeek(ymdToLocalDate(date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

/**
 * Ключ следующей корзины. Нужен, чтобы пустые периоды рисовались нулём, а не
 * склеивались: месяц без уроков — это факт, и на склеенном ряде летнего провала
 * не видно вовсе.
 *
 * Строго возрастает и остаётся в том же формате, что `bucketKey`, — по нему же
 * сравниваются границы обхода.
 */
export function nextBucketKey(key: string, view: View) {
  if (view === 'year') return String(Number(key) + 1)
  if (view === 'month') return format(addMonths(ymdToLocalDate(`${key}-01`), 1), 'yyyy-MM')
  return format(addDays(ymdToLocalDate(key), 7), 'yyyy-MM-dd')
}

export function bucketLabel(key: string, view: View) {
  if (view === 'year') return key
  // Месяцу дописываем первое число: `ymdToLocalDate` ждёт полную дату. У недели
  // ключ уже полный — это её понедельник, его и показываем.
  const date = ymdToLocalDate(view === 'month' ? `${key}-01` : key)
  return format(date, view === 'month' ? 'LLL yy' : 'd MMM yy', { locale: ru })
}

/**
 * Границы корзины — тем же форматом `YYYY-MM-DD`, что ждёт фильтр периода. Обе
 * включительно, как и его сравнение.
 */
export function bucketRange(key: string, view: View): Period {
  if (view === 'year') return { from: `${key}-01-01`, to: `${key}-12-31` }
  if (view === 'month') {
    return { from: `${key}-01`, to: dateToYmd(endOfMonth(ymdToLocalDate(`${key}-01`))) }
  }
  // Ключ недели — её понедельник, конец — воскресенье.
  return { from: key, to: dateToYmd(addDays(ymdToLocalDate(key), 6)) }
}
