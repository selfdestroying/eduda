/** Режим отображения календаря. */
export type CalendarView = 'day' | 'week' | 'month' | 'year' | 'list'

/** День недели, с которого начинается неделя. */
export type WeekStart = 'Sunday' | 'Monday'

/** Измерение фильтрации боковой панели. */
export type FilterDimension = 'course' | 'location' | 'teacher' | 'groupType'

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
  groupId: number
  locationId: number
  /** Тип группы (может отсутствовать). */
  groupTypeId: number | null
  groupType: string | null
  /** Преподаватели группы урока (может быть пусто). */
  teachers: CalendarTeacher[]
  cancelled: boolean
  /** Посещаемость проставлена у всех учеников урока. */
  allMarked: boolean
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
  /** Курс — измерение фильтра. */
  courseId: number
  /** Группа урока — для перехода на страницу группы. */
  groupId: number
  /** Цвет события — определяется типом группы. */
  color: string
  /** Локация урока — измерение фильтра. */
  locationId: number
  /** Тип группы — измерение фильтра и источник цвета (0 = «Без типа»). */
  groupTypeId: number
  groupType: string
  /** Преподаватели урока — измерение фильтра (много значений). */
  teachers: CalendarTeacher[]
  cancelled: boolean
  /** Посещаемость проставлена у всех учеников урока. */
  allMarked: boolean
}

/** Статус отметки посещаемости за день (для точек под датами). */
export type DayStatus = 'marked' | 'unmarked'

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
