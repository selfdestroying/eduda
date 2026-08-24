import { Prisma } from '@repo/db'

/** Students list - includes groups, wallets, parents */
export type StudentWithGroups = Prisma.StudentGetPayload<{
  include: { groups: true; wallets: true; parents: { include: { parent: true } } }
}>

/** Student detail page - full payload with attendance, wallets, parents */
export type StudentDetail = Prisma.StudentGetPayload<{
  include: {
    account: true
    parents: { include: { parent: true } }
    groups: {
      include: {
        group: {
          include: {
            lessons: {
              include: {
                attendance: {
                  include: {
                    makeupAttendance: { include: { lesson: true } }
                  }
                }
              }
            }
            course: true
            location: true
            schedules: true
          }
        }
      }
    }
    wallets: {
      include: {
        studentGroups: {
          include: {
            group: { include: { course: true; location: true; schedules: true } }
          }
        }
        packages: true
      }
    }
  }
}>

/**
 * Поля, которые рисует таблица учеников, — и ничего сверх них. `include: true` по
 * кошелькам и родителям тянул в браузер все их скаляры на каждую строку.
 *
 * Собственные `lessonsBalance`/`totalLessons`/`totalPayments` ученика остались
 * рядом с кошельковыми: это доденьги-до-кошельков остаток, и итог в строке —
 * сумма обоих. Убрать их можно только вместе с колонками в базе.
 */
export const STUDENT_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  birthDate: true,
  dataActualizedAt: true,
  lessonsBalance: true,
  totalLessons: true,
  totalPayments: true,
  wallets: { select: { lessonsBalance: true, totalLessons: true, totalPayments: true } },
  parents: { select: { parent: { select: { id: true, firstName: true, lastName: true } } } },
} satisfies Prisma.StudentSelect

/** Строка таблицы. */
export type StudentListItem = Prisma.StudentGetPayload<{ select: typeof STUDENT_LIST_SELECT }>

/**
 * Срез плюс общее число строк по тому же `where`. `total` нужен пагинации: сама
 * она видит только текущую страницу и посчитать количество страниц не может.
 */
export type StudentListResult = {
  rows: StudentListItem[]
  total: number
}
