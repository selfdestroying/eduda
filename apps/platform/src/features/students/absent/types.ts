import { Prisma } from '@repo/db'

/**
 * Поля, которые рисует таблица пропусков, — и ничего сверх них. `include: true` по
 * связям тянул в браузер все скаляры ученика, урока, группы, курса и локации на
 * каждую строку.
 *
 * Преподаватели берутся с урока (`lesson.teachers`), а не с группы: строка — это
 * конкретный пропущенный урок, и вести его мог не тот, кто закреплён за группой
 * сегодня. Строки `TeacherLesson` заводятся при создании урока из состава группы,
 * так что для прошедших уроков это как раз тот, кто урок вёл.
 */
export const ABSENT_LIST_SELECT = {
  id: true,
  comment: true,
  isWarned: true,
  // Обе стороны связи отработок: `makeupAttendance` — отработка, назначенная на
  // этот пропуск, `makeupForAttendance` — пропуск, отработкой которого эта строка
  // сама является. Без второй строка-отработка в колонке неотличима от пропуска,
  // которым никто не занимался.
  makeupAttendance: { select: { lessonId: true, lesson: { select: { date: true } } } },
  makeupForAttendance: { select: { lessonId: true, lesson: { select: { date: true } } } },
  student: { select: { id: true, firstName: true, lastName: true, url: true } },
  lesson: {
    select: {
      date: true,
      group: {
        select: {
          id: true,
          name: true,
          course: { select: { name: true } },
          location: { select: { name: true } },
          // Нужны `getGroupName`, когда у группы нет своего имени.
          schedules: { select: { dayOfWeek: true, time: true } },
        },
      },
      teachers: { select: { teacher: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.AttendanceSelect

/** Строка таблицы. */
export type AbsentListItem = Prisma.AttendanceGetPayload<{
  select: typeof ABSENT_LIST_SELECT
}>

/**
 * Срез плюс общее число строк по тому же `where`. `total` нужен пагинации: сама
 * она видит только текущую страницу и посчитать количество страниц не может.
 */
export type AbsentListResult = {
  rows: AbsentListItem[]
  total: number
}

/**
 * Точка графика — один календарный день (`YYYY-MM-DD`) в двух режимах: пропуски
 * штуками и они же в рублях. Оба приходят всегда, потому что считаются из одних
 * строк, — переключение режима выбирает из готовых чисел, а не идёт на сервер.
 */
export type AbsentChartPoint = {
  date: string
  warned: number
  unwarned: number
  /**
   * Деньги, потерянные родителями за день: цена занятия у непредупреждённых
   * пропусков. Предупреждённый пропуск не списывается (`isLessonCharged`), значит
   * и не стоит родителю ничего.
   */
  lost: number
  /**
   * Обратная величина: цена занятия у предупреждённых пропусков, которые ученик
   * отходил — отработка назначена и посещена. Это те деньги, которые родитель
   * потерял бы, не предупреди он о пропуске.
   *
   * Считается по цене самой отработки: списание произошло на ней, а не на
   * пропуске. Отработка назначенная, но ещё не проведённая, сюда не идёт —
   * спасено пока ничего.
   */
  saved: number
}
