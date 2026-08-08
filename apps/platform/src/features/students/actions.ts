'use server'

import { Prisma } from '@repo/db'
import {
  CoinTxReason,
  StudentFinancialField,
  StudentLessonsBalanceChangeReason,
} from '@repo/db/enums'

import { prisma } from '@repo/db'
import { recordCoins } from '@/src/lib/coins'
import {
  type StudentFinancialAudit,
  FINANCIAL_FIELD_KEY,
  parseIntFieldChange,
  writeFinancialHistoryTx,
} from '@/src/lib/lessons-balance'
import { ConflictError, NotFoundError } from '@/src/lib/error'
import { authAction, featureAction, permissionAction } from '@/src/lib/safe-action'
import { createStudentUserTx, hashStudentPassword } from '@/src/lib/student-auth'
import { isProfileEdit } from '@/src/lib/student-data'
import { decryptStudentPassword } from '@/src/lib/student-password'
import { todayYmdInTz } from '@/src/lib/timezone'
import { randomInt } from 'crypto'
import * as z from 'zod'
import {
  CreateStudentSchema,
  DeleteStudentSchema,
  RevealStudentPasswordSchema,
  UpdateStudentCoinsSchema,
} from './schemas'

const transliterateToLatin = (value: string) => {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  }
  return value
    .toLowerCase()
    .split('')
    .map((char) => map[char] ?? char)
    .join('')
}

function generateLogin(firstName: string, lastName: string) {
  const first = transliterateToLatin(firstName).replace(/[^a-z]/g, '')
  const last = transliterateToLatin(lastName).replace(/[^a-z]/g, '')
  return `${first}${last}${randomInt(10, 99)}`
}

/**
 * Логин уникален глобально — вход в шоп идёт на едином домене, без поддомена
 * школы, так что «ivanov» в двух школах столкнулись бы. Случайный суффикс делает
 * коллизию редкой; на всякий случай перебираем несколько вариантов, а последнее
 * слово всё равно за уникальными индексами в БД.
 *
 * Сравнение регистронезависимое: better-auth ищет username в нижнем регистре,
 * поэтому занятый «Ivanov» делает занятым и «ivanov».
 */
async function pickFreeLogin(firstName: string, lastName: string) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const login = generateLogin(firstName, lastName)
    const taken = await prisma.studentAccount.findFirst({
      where: { login: { equals: login, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!taken) return login
  }
  throw new ConflictError('Логин занят — попробуйте ещё раз')
}

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join('')
}

// ─── READ ────────────────────────────────────────────────────────────────────

export const getStudents = authAction
  .metadata({ actionName: 'getStudents' })
  .action(async ({ ctx }) => {
    return await prisma.student.findMany({
      where: { organizationId: ctx.session.organizationId! },
      include: {
        groups: { where: { status: { in: ['ACTIVE', 'TRIAL'] } } },
        wallets: true,
        parents: { include: { parent: true } },
      },
      orderBy: { id: 'asc' },
    })
  })

// Лёгкий поиск учеников по имени для async-комбобокса (id + ФИО, максимум 20)
export const searchStudents = authAction
  .metadata({ actionName: 'searchStudents' })
  .inputSchema(z.object({ query: z.string() }))
  .action(async ({ ctx, parsedInput }) => {
    const q = parsedInput.query.trim()
    return await prisma.student.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 20,
    })
  })

export const getStudent = authAction
  .metadata({ actionName: 'getStudent' })
  .inputSchema(
    z.object({
      id: z.number().int().positive(),
      include: z.any().optional(),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.student.findFirst({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      include: parsedInput.include,
    })
  })

export const getStudentDetail = authAction
  .metadata({ actionName: 'getStudentDetail' })
  .inputSchema(z.object({ id: z.number().int().positive() }))
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.student.findFirst({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      include: {
        account: true,
        parents: { include: { parent: true } },
        groups: {
          include: {
            group: {
              include: {
                lessons: {
                  include: {
                    attendance: {
                      where: { studentId: parsedInput.id },
                      include: {
                        makeupAttendance: { include: { lesson: true } },
                      },
                    },
                  },
                  orderBy: { date: 'asc' },
                },
                course: true,
                location: true,
                schedules: true,
              },
            },
          },
        },
        wallets: {
          include: {
            studentGroups: {
              include: {
                group: { include: { course: true, location: true, schedules: true } },
              },
            },
          },
        },
      },
    })
  })

// ─── CREATE ──────────────────────────────────────────────────────────────────

export const createStudent = authAction
  .metadata({ actionName: 'createStudent' })
  .inputSchema(CreateStudentSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { firstName, lastName, birthDate, url, parentMode, newParent, existingParentId } =
      parsedInput

    const login = await pickFreeLogin(firstName, lastName)
    const password = generatePassword()
    const organizationId = ctx.session.organizationId!
    // scrypt считается до транзакции — держать её открытой на время хеширования незачем.
    const hash = await hashStudentPassword(password)

    await prisma.$transaction(async (tx) => {
      const { studentUserId, passwordEnc } = await createStudentUserTx(tx, {
        login,
        password,
        hash,
        name: `${lastName} ${firstName}`,
      })

      const student = await tx.student.create({
        data: {
          firstName,
          lastName,
          birthDate,
          url,
          organizationId,
          // organizationId обязателен явно: в схеме у Cart стоит @default(1), и
          // без него корзина ученика уезжает в чужую школу, а шоп её не находит.
          cart: { create: { organizationId } },
          account: { create: { login, passwordEnc, studentUserId, organizationId } },
        },
      })

      if (parentMode === 'new' && newParent) {
        const parent = await tx.parent.create({
          data: { ...newParent, organizationId },
        })
        await tx.studentParent.create({
          data: { studentId: student.id, parentId: parent.id, organizationId },
        })
      } else if (parentMode === 'existing' && existingParentId) {
        await tx.studentParent.create({
          data: { studentId: student.id, parentId: existingParentId, organizationId },
        })
      }
    })
  })

// ─── ПАРОЛЬ УЧЕНИКА ──────────────────────────────────────────────────────────

/**
 * Расшифровывает пароль ученика для показа в карточке. За permission-гейтом,
 * каждый показ логируется: пароль виден только тому, кто и так может менять
 * ученика, и не «просто так», а под запись.
 */
export const revealStudentPassword = permissionAction({ student: ['update'] })
  .metadata({ actionName: 'revealStudentPassword' })
  .inputSchema(RevealStudentPasswordSchema)
  .action(async ({ ctx, parsedInput }) => {
    const account = await prisma.studentAccount.findFirst({
      where: {
        studentId: parsedInput.studentId,
        organizationId: ctx.session.organizationId!,
      },
      select: { passwordEnc: true },
    })

    if (!account?.passwordEnc) {
      throw new NotFoundError('Пароль не найден — пересоздайте учётную запись ученика')
    }

    console.info(
      '[audit] revealStudentPassword',
      JSON.stringify({
        actorUserId: ctx.session.user.id,
        organizationId: ctx.session.organizationId,
        studentId: parsedInput.studentId,
        at: new Date().toISOString(),
      }),
    )

    return { password: decryptStudentPassword(account.passwordEnc) }
  })

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export const updateStudent = authAction
  .metadata({ actionName: 'updateStudent' })
  .inputSchema(
    z.object({
      payload: z.any(),
      audit: z.any().optional(),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    const payload = parsedInput.payload as Prisma.StudentUpdateArgs
    const audit = parsedInput.audit as StudentFinancialAudit | undefined
    const data = payload.data as Prisma.StudentUpdateInput | undefined

    const financialFields = [
      StudentFinancialField.LESSONS_BALANCE,
      StudentFinancialField.TOTAL_PAYMENTS,
      StudentFinancialField.TOTAL_LESSONS,
    ] as const

    const changes = financialFields
      .map((field) => {
        const key = FINANCIAL_FIELD_KEY[field]
        const change = parseIntFieldChange(data?.[key])
        return change ? { field, key, change } : null
      })
      .filter(Boolean) as {
      field: StudentFinancialField
      key: 'lessonsBalance' | 'totalPayments' | 'totalLessons'
      change: NonNullable<ReturnType<typeof parseIntFieldChange>>
    }[]

    // Актуальность данных = дата последней правки анкеты.
    const profileEdited = isProfileEdit(data)
    const withTouch = (args: Prisma.StudentUpdateArgs): Prisma.StudentUpdateArgs =>
      profileEdited
        ? { ...args, data: { ...(args.data as object), dataActualizedAt: new Date() } }
        : args

    const studentId = payload.where.id
    if (!studentId) {
      await prisma.student.update(withTouch(payload))
      return
    }

    if (changes.length === 0) {
      await prisma.student.update(withTouch(payload))
      return
    }

    for (const c of changes) {
      if (!audit?.[c.field]) {
        throw new Error(`Для изменения поля ${c.key} требуется указать причину (audit.${c.field})`)
      }
    }

    await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
      })

      if (!student) throw new Error('Ученик не найден')

      const updated = await tx.student.update({
        where: { id: studentId },
        data: withTouch(payload).data as Prisma.StudentUpdateInput,
        select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
      })

      for (const c of changes) {
        const fieldAudit = audit![c.field]!
        const balanceBefore = student[c.key]
        const balanceAfter = updated[c.key]
        const delta = balanceAfter - balanceBefore

        await writeFinancialHistoryTx(tx, {
          organizationId: ctx.session.organizationId!,
          studentId,
          actorUserId: Number(ctx.session.user.id),
          field: c.field,
          reason: fieldAudit.reason,
          delta,
          balanceBefore,
          balanceAfter,
          comment: fieldAudit.comment,
          meta: fieldAudit.meta,
        })
      }
    })
  })

// ─── DELETE ──────────────────────────────────────────────────────────────────

export const deleteStudent = authAction
  .metadata({ actionName: 'deleteStudent' })
  .inputSchema(DeleteStudentSchema)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = ctx.session.organizationId!

    await prisma.$transaction(async (tx) => {
      // Убеждаемся, что ученик принадлежит организации, прежде чем удалять связанные записи
      const student = await tx.student.findFirst({
        where: { id: parsedInput.id, organizationId },
        select: { id: true },
      })
      if (!student) throw new Error('Ученик не найден')

      // Удаляем связи без каскада (Payment и StudentAccount имеют onDelete: Restrict).
      // Остальные связи (кошельки, группы, посещения, заказы, история, корзина, родители)
      // удаляются каскадно при удалении ученика.
      await tx.payment.deleteMany({ where: { studentId: student.id, organizationId } })

      // Учётка better-auth не висит на ученике и каскадом не уходит. Без явного
      // удаления логин остаётся занятым навсегда (username уникален), а по
      // сохранившемуся паролю удалённый ученик продолжает получать сессию.
      // Удаление StudentUser каскадом гасит его credential и сессии.
      const account = await tx.studentAccount.findUnique({
        where: { studentId: student.id },
        select: { studentUserId: true },
      })
      await tx.studentAccount.deleteMany({ where: { studentId: student.id } })
      if (account?.studentUserId) {
        await tx.studentUser.delete({ where: { id: account.studentUserId } })
      }

      await tx.student.delete({ where: { id: student.id } })
    })
  })

// ─── UPDATE COINS ────────────────────────────────────────────────────────────

export const updateStudentCoins = authAction
  .metadata({ actionName: 'updateStudentCoins' })
  .inputSchema(UpdateStudentCoinsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = ctx.session.organizationId!
    const { studentId, coins } = parsedInput

    // Всё одной транзакцией: строка леджера обязана появиться вместе с
    // изменением баланса, иначе инвариант «сумма леджера = coins» разъедется.
    await prisma.$transaction(async (tx) => {
      // Условный `updateMany` заодно закрывает гонку двух списаний: при
      // недостатке монет он просто не найдёт строку.
      const { count } = await tx.studentAccount.updateMany({
        where: {
          studentId,
          organizationId,
          ...(coins < 0 ? { coins: { gte: -coins } } : {}),
        },
        data: { coins: { increment: coins } },
      })

      if (count === 0) {
        throw new ConflictError(
          coins < 0 ? 'Недостаточно монет для списания' : 'Аккаунт ученика не найден',
        )
      }

      await recordCoins(tx, {
        organizationId,
        studentId,
        amount: coins,
        reason: coins > 0 ? CoinTxReason.MANUAL_GRANT : CoinTxReason.MANUAL_DEDUCT,
      })
    })
  })

// ─── STUDENT GROUP BALANCE ───────────────────────────────────────────────────

export const updateStudentGroupBalance = authAction
  .metadata({ actionName: 'updateStudentGroupBalance' })
  .inputSchema(
    z.object({
      studentId: z.number().int().positive(),
      groupId: z.number().int().positive(),
      data: z.any(),
      audit: z.any(),
      payment: z
        .object({
          lessonCount: z.number(),
          price: z.number(),
          bidForLesson: z.number(),
          leadName: z.string(),
          productName: z.string(),
        })
        .optional(),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    const { studentId, groupId, payment } = parsedInput
    const data = parsedInput.data as {
      lessonsBalance?: Prisma.IntFieldUpdateOperationsInput | number
      totalLessons?: Prisma.IntFieldUpdateOperationsInput | number
      totalPayments?: Prisma.IntFieldUpdateOperationsInput | number
    }
    const audit = parsedInput.audit as StudentFinancialAudit

    const financialFields = [
      StudentFinancialField.LESSONS_BALANCE,
      StudentFinancialField.TOTAL_PAYMENTS,
      StudentFinancialField.TOTAL_LESSONS,
    ] as const

    const changes = financialFields
      .map((field) => {
        const key = FINANCIAL_FIELD_KEY[field]
        const change = parseIntFieldChange(data[key] as Prisma.StudentUpdateInput['lessonsBalance'])
        return change ? { field, key, change } : null
      })
      .filter(Boolean) as {
      field: StudentFinancialField
      key: 'lessonsBalance' | 'totalPayments' | 'totalLessons'
      change: NonNullable<ReturnType<typeof parseIntFieldChange>>
    }[]

    if (changes.length === 0) return

    for (const c of changes) {
      if (!audit[c.field]) {
        throw new Error(`Для изменения поля ${c.key} требуется указать причину (audit.${c.field})`)
      }
    }

    await prisma.$transaction(async (tx) => {
      const sg = await tx.studentGroup.findUnique({
        where: { studentId_groupId: { studentId, groupId } },
        select: {
          organizationId: true,
          walletId: true,
        },
      })
      if (!sg) throw new Error('Ученик не найден в группе')
      if (!sg.walletId) throw new Error('У ученика нет привязанного кошелька')

      if (payment) {
        await tx.payment.create({
          data: {
            organizationId: sg.organizationId,
            studentId,
            groupId,
            walletId: sg.walletId,
            lessonCount: payment.lessonCount,
            price: payment.price,
            bidForLesson: payment.bidForLesson,
            leadName: payment.leadName,
            productName: payment.productName,
            date: todayYmdInTz(ctx.tz),
          },
        })
      }

      const wallet = await tx.wallet.findUnique({
        where: { id: sg.walletId },
        select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
      })
      if (!wallet) throw new Error('Кошелёк не найден')

      const updated = await tx.wallet.update({
        where: { id: sg.walletId },
        data,
        select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
      })

      for (const c of changes) {
        const fieldAudit = audit[c.field]!
        const balanceBefore = wallet[c.key]
        const balanceAfter = updated[c.key]
        const delta = balanceAfter - balanceBefore

        await writeFinancialHistoryTx(tx, {
          organizationId: ctx.session.organizationId!,
          studentId,
          actorUserId: Number(ctx.session.user.id),
          groupId,
          walletId: sg.walletId,
          field: c.field,
          reason: fieldAudit.reason,
          delta,
          balanceBefore,
          balanceAfter,
          comment: fieldAudit.comment,
          meta: fieldAudit.meta,
        })
      }
    })
  })

// ─── REDISTRIBUTE BALANCE ────────────────────────────────────────────────────

export const redistributeBalance = authAction
  .metadata({ actionName: 'redistributeBalance' })
  .inputSchema(
    z.object({
      studentId: z.number().int().positive(),
      allocations: z.array(
        z.object({
          walletId: z.number().int().positive(),
          lessons: z.number().optional(),
          totalLessons: z.number().optional(),
          totalPayments: z.number().optional(),
        }),
      ),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    const { studentId, allocations } = parsedInput

    const sumLessons = allocations.reduce((sum, a) => sum + (a.lessons ?? 0), 0)
    const sumTotalLessons = allocations.reduce((sum, a) => sum + (a.totalLessons ?? 0), 0)
    const sumTotalPayments = allocations.reduce((sum, a) => sum + (a.totalPayments ?? 0), 0)

    await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { lessonsBalance: true, totalLessons: true, totalPayments: true },
      })
      if (!student) throw new Error('Ученик не найден')

      if (sumLessons > student.lessonsBalance) {
        throw new Error(
          `Невозможно распределить ${sumLessons} ур. Нераспределённый остаток: ${student.lessonsBalance}`,
        )
      }
      if (sumTotalLessons > student.totalLessons) {
        throw new Error(
          `Невозможно распределить ${sumTotalLessons} всего уроков. Нераспределённый остаток: ${student.totalLessons}`,
        )
      }
      if (sumTotalPayments > student.totalPayments) {
        throw new Error(
          `Невозможно распределить ${sumTotalPayments} ₽. Нераспределённый остаток: ${student.totalPayments}`,
        )
      }

      for (const alloc of allocations) {
        const hasLessons = (alloc.lessons ?? 0) > 0
        const hasTotalLessons = (alloc.totalLessons ?? 0) > 0
        const hasTotalPayments = (alloc.totalPayments ?? 0) > 0
        if (!hasLessons && !hasTotalLessons && !hasTotalPayments) continue

        const wallet = await tx.wallet.findUnique({
          where: { id: alloc.walletId },
          select: {
            lessonsBalance: true,
            totalLessons: true,
            totalPayments: true,
            studentId: true,
            status: true,
          },
        })
        if (!wallet) throw new Error(`Кошелёк ${alloc.walletId} не найден`)
        if (wallet.studentId !== studentId) throw new Error('Кошелёк не принадлежит этому ученику')
        if (wallet.status === 'ARCHIVED') {
          throw new Error('Нельзя распределить баланс на архивный кошелёк')
        }

        const updateData: Prisma.WalletUpdateInput = {}
        const decrementStudent: Prisma.StudentUpdateInput = {}

        if (hasLessons) {
          updateData.lessonsBalance = { increment: alloc.lessons! }
          decrementStudent.lessonsBalance = { decrement: alloc.lessons! }
        }
        if (hasTotalLessons) {
          updateData.totalLessons = { increment: alloc.totalLessons! }
          decrementStudent.totalLessons = { decrement: alloc.totalLessons! }
        }
        if (hasTotalPayments) {
          updateData.totalPayments = { increment: alloc.totalPayments! }
          decrementStudent.totalPayments = { decrement: alloc.totalPayments! }
        }

        const updated = await tx.wallet.update({
          where: { id: alloc.walletId },
          data: updateData,
          select: { lessonsBalance: true, totalLessons: true, totalPayments: true },
        })

        await tx.student.update({
          where: { id: studentId },
          data: decrementStudent,
        })

        if (hasLessons) {
          await writeFinancialHistoryTx(tx, {
            organizationId: ctx.session.organizationId!,
            studentId,
            actorUserId: Number(ctx.session.user.id),
            walletId: alloc.walletId,
            field: StudentFinancialField.LESSONS_BALANCE,
            reason: StudentLessonsBalanceChangeReason.BALANCE_REDISTRIBUTED,
            delta: alloc.lessons!,
            balanceBefore: wallet.lessonsBalance,
            balanceAfter: updated.lessonsBalance,
            comment: 'Распределение баланса уроков по кошелькам',
          })
        }
        if (hasTotalLessons) {
          await writeFinancialHistoryTx(tx, {
            organizationId: ctx.session.organizationId!,
            studentId,
            actorUserId: Number(ctx.session.user.id),
            walletId: alloc.walletId,
            field: StudentFinancialField.TOTAL_LESSONS,
            reason: StudentLessonsBalanceChangeReason.BALANCE_REDISTRIBUTED,
            delta: alloc.totalLessons!,
            balanceBefore: wallet.totalLessons,
            balanceAfter: updated.totalLessons,
            comment: 'Распределение всего уроков по кошелькам',
          })
        }
        if (hasTotalPayments) {
          await writeFinancialHistoryTx(tx, {
            organizationId: ctx.session.organizationId!,
            studentId,
            actorUserId: Number(ctx.session.user.id),
            walletId: alloc.walletId,
            field: StudentFinancialField.TOTAL_PAYMENTS,
            reason: StudentLessonsBalanceChangeReason.BALANCE_REDISTRIBUTED,
            delta: alloc.totalPayments!,
            balanceBefore: wallet.totalPayments,
            balanceAfter: updated.totalPayments,
            comment: 'Распределение суммы оплат по кошелькам',
          })
        }
      }
    })
  })

// ─── BALANCE HISTORY ─────────────────────────────────────────────────────────

export const getStudentLessonsBalanceHistory = authAction
  .metadata({ actionName: 'getStudentLessonsBalanceHistory' })
  .inputSchema(
    z.object({
      studentId: z.number().int().positive(),
      take: z.number().int().positive().optional().default(50),
      groupId: z.number().int().positive().optional(),
    }),
  )
  .action(async ({ parsedInput }) => {
    return await prisma.studentLessonsBalanceHistory.findMany({
      where: {
        studentId: parsedInput.studentId,
        ...(parsedInput.groupId != null ? { groupId: parsedInput.groupId } : {}),
      },
      take: parsedInput.take,
      orderBy: { createdAt: 'desc' },
      include: {
        actorUser: true,
        group: { include: { course: true, location: true } },
      },
    })
  })

export const updateStudentBalanceHistory = authAction
  .metadata({ actionName: 'updateStudentBalanceHistory' })
  .inputSchema(
    z.object({
      id: z.number().int().positive(),
      data: z.any(),
    }),
  )
  .action(async ({ parsedInput }) => {
    return await prisma.studentLessonsBalanceHistory.update({
      where: { id: parsedInput.id },
      data: parsedInput.data as Prisma.StudentLessonsBalanceHistoryUpdateInput,
    })
  })

// ─── GROUP HISTORY ───────────────────────────────────────────────────────────

export type StudentGroupHistoryEntry = {
  type: 'joined' | 'dismissed'
  date: string
  groupId: number
  groupName: string
  status?: string
}

const DaysShort: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  0: 'Вс',
}

export const getStudentGroupHistory = authAction
  .metadata({ actionName: 'getStudentGroupHistory' })
  .inputSchema(
    z.object({
      studentId: z.number().int().positive(),
    }),
  )
  .action(async ({ ctx, parsedInput }): Promise<StudentGroupHistoryEntry[]> => {
    const { studentId } = parsedInput
    const organizationId = ctx.session.organizationId!

    const [attendances, currentGroups] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          studentId,
          organizationId,
          makeupForAttendanceId: null,
        },
        include: {
          lesson: {
            include: {
              group: {
                include: {
                  course: true,
                  location: true,
                  schedules: true,
                },
              },
            },
          },
        },
        orderBy: { lesson: { date: 'asc' } },
      }),
      prisma.studentGroup.findMany({
        where: { studentId, organizationId },
        select: { groupId: true, status: true },
      }),
    ])

    const currentGroupMap = new Map(currentGroups.map((sg) => [sg.groupId, sg.status]))

    const groupStats = new Map<
      number,
      {
        firstDate: string
        lastDate: string
        group: (typeof attendances)[number]['lesson']['group']
      }
    >()

    for (const att of attendances) {
      const gId = att.lesson.groupId
      const date = att.lesson.date
      const existing = groupStats.get(gId)
      if (!existing) {
        groupStats.set(gId, { firstDate: date, lastDate: date, group: att.lesson.group })
      } else {
        if (date < existing.firstDate) existing.firstDate = date
        if (date > existing.lastDate) existing.lastDate = date
      }
    }

    function buildGroupName(g: (typeof attendances)[number]['lesson']['group']) {
      const sorted = [...g.schedules].sort(
        (a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7),
      )
      const parts = sorted.map((s) => `${DaysShort[s.dayOfWeek]} ${s.time}`)
      return `${g.course.name} ${parts.join(', ')}`
    }

    const entries: StudentGroupHistoryEntry[] = []

    for (const [groupId, stats] of groupStats) {
      const name = buildGroupName(stats.group)

      entries.push({
        type: 'joined',
        date: stats.firstDate,
        groupId,
        groupName: name,
        status: currentGroupMap.get(groupId) ?? undefined,
      })

      if (!currentGroupMap.has(groupId) || currentGroupMap.get(groupId) === 'DISMISSED') {
        entries.push({
          type: 'dismissed',
          date: stats.lastDate,
          groupId,
          groupName: name,
        })
      }
    }

    entries.sort((a, b) => b.date.localeCompare(a.date))

    return entries
  })

// ─── SHOP STATS ──────────────────────────────────────────────────────────────

export const getStudentShopStats = featureAction('shop')
  .metadata({ actionName: 'getStudentShopStats' })
  .inputSchema(z.object({ studentId: z.number().int().positive() }))
  .action(async ({ ctx, parsedInput }) => {
    const { studentId } = parsedInput
    const organizationId = ctx.session.organizationId!

    const [account, allOrders, recentOrders] = await Promise.all([
      prisma.studentAccount.findFirst({
        where: { studentId, student: { organizationId } },
        select: { coins: true },
      }),
      prisma.order.findMany({
        where: { studentId, organizationId },
        select: {
          status: true,
          items: { select: { quantity: true, priceAtPurchase: true } },
        },
      }),
      prisma.order.findMany({
        where: { studentId, organizationId },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    let totalSpent = 0
    let totalOrders = 0
    let pendingOrders = 0
    let completedOrders = 0
    let cancelledOrders = 0

    for (const o of allOrders) {
      totalOrders += 1
      if (o.status === 'PENDING') pendingOrders += 1
      if (o.status === 'COMPLETED') completedOrders += 1
      if (o.status === 'CANCELLED') cancelledOrders += 1
      if (o.status !== 'CANCELLED') {
        // По снимку цены: сколько коинов реально ушло, а не сколько товар стоит сейчас.
        totalSpent += o.items.reduce((sum, i) => sum + i.priceAtPurchase * i.quantity, 0)
      }
    }

    return {
      coins: account?.coins ?? 0,
      totalSpent,
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      recentOrders,
    }
  })
