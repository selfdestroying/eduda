/** Режим отображения календаря. */
export type CalendarView = 'day' | 'week' | 'month' | 'year' | 'list'

/** День недели, с которого начинается неделя. */
export type WeekStart = 'Sunday' | 'Monday'

/** Измерение фильтрации боковой панели. */
export type FilterDimension = 'course' | 'location' | 'teacher'

/** Преподаватель урока (id + имя). */
export interface CalendarTeacher {
  id: number
  name: string
}

/** Облегчённый DTO урока, возвращаемый server action для календаря. */
export interface CalendarLessonDTO {
  id: number
  /** Дата в формате `YYYY-MM-DD`. */
  date: string
  /** Время начала, `HH:MM`. */
  time: string
  /** Длительность в минутах. */
  duration: number
  /** Заголовок (название курса). */
  title: string
  /** Локация (для подзаголовка). */
  location: string
  courseId: number
  locationId: number
  /** Преподаватели группы урока (может быть пусто). */
  teachers: CalendarTeacher[]
  cancelled: boolean
}

/**
 * Урок, нормализованный для отрисовки на календаре.
 * `start` / `end` — минуты от полуночи.
 */
export interface CalendarEvent {
  id: string
  lessonId: number
  /** Дата в формате `YYYY-MM-DD`. */
  date: string
  title: string
  location: string
  start: number
  end: number
  /** Курс — используется как «календарь» (категория) для фильтра и цвета. */
  courseId: number
  color: string
  /** Локация урока — измерение фильтра. */
  locationId: number
  /** Преподаватели урока — измерение фильтра (много значений). */
  teachers: CalendarTeacher[]
  cancelled: boolean
}

/** Категория-«календарь» в боковой панели (фильтр по цвету). */
export interface CalendarCategory {
  id: number
  name: string
  color: string
  count: number
}

/** Результат раскладки пересекающихся событий по колонкам-дорожкам. */
export interface LayoutSlot {
  lane: number
  lanes: number
}
