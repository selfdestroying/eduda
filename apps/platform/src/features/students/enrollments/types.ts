import { Prisma } from '@repo/db'

/**
 * Поля, которые рисуют таблицы записей «ученик — группа», — и ничего сверх них.
 * `include: true` по связям тянул в браузер все скаляры ученика, группы, курса,
 * локации и кошелька на каждую строку.
 *
 * Один select на три страницы: `statusComment` и `statusChangedAt` нужны только
 * отчисленным, но это скаляры самой записи — отдельная выборка ради них стоила бы
 * дороже, чем два лишних поля в строке.
 */
export const ENROLLMENT_LIST_SELECT = {
  studentId: true,
  groupId: true,
  status: true,
  statusChangedAt: true,
  statusComment: true,
  student: { select: { id: true, firstName: true, lastName: true, url: true } },
  wallet: { select: { lessonsBalance: true, totalLessons: true, totalPayments: true } },
  group: {
    select: {
      id: true,
      name: true,
      course: { select: { name: true } },
      location: { select: { name: true } },
      // Нужны `getGroupName`, когда у группы нет своего имени.
      schedules: { select: { dayOfWeek: true, time: true } },
      teachers: { select: { teacher: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.StudentGroupSelect

/** Строка таблицы. */
export type EnrollmentListItem = Prisma.StudentGroupGetPayload<{
  select: typeof ENROLLMENT_LIST_SELECT
}>

/**
 * Срез плюс общее число строк по тому же `where`. `total` нужен пагинации: сама
 * она видит только текущую страницу и посчитать количество страниц не может.
 */
export type EnrollmentListResult = {
  rows: EnrollmentListItem[]
  total: number
}
