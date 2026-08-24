'use server'

import { Prisma, prisma } from '@repo/db'
import { authAction, permissionAction } from '@/src/lib/safe-action'
import {
  CreateExpenseSchema,
  DeleteExpenseSchema,
  ExpenseListSchema,
  UpdateExpenseSchema,
} from './schemas'
import { EXPENSE_LIST_SELECT, type ExpenseListResult } from './types'

type ExpenseOrderBy = Prisma.ExpenseOrderByWithRelationInput

/**
 * Разрешённые колонки сортировки: id колонки таблицы → как её сортировать. Белый
 * список, а не подстановка поля из запроса: `sort` приходит из адресной строки.
 * Неизвестный ключ даёт порядок по умолчанию, без ошибки.
 */
const EXPENSE_ORDER_BY: Record<string, (dir: Prisma.SortOrder) => ExpenseOrderBy[]> = {
  name: (dir) => [{ name: dir }],
  amount: (dir) => [{ amount: dir }],
  date: (dir) => [{ date: dir }],
}

/**
 * Порядок строк. Последним ключом всегда `id`: без него расходы одного дня при
 * листании переставляются местами, и один и тот же успевает показаться на двух
 * страницах подряд.
 */
function resolveExpenseOrderBy(sort: { id: string; desc: boolean } | null | undefined) {
  const build = sort ? EXPENSE_ORDER_BY[sort.id] : undefined
  if (!sort || !build) return [{ date: 'desc' as const }, { id: 'desc' as const }]
  return [...build(sort.desc ? 'desc' : 'asc'), { id: 'desc' as const }]
}

/**
 * Поиск по тому, что видно в строке: название и комментарий. Слова требуются все,
 * но каждое может найтись в любом поле.
 */
function expenseSearchWhere(search: string | undefined): Prisma.ExpenseWhereInput[] | undefined {
  const terms = search?.split(/\s+/).filter(Boolean) ?? []
  if (terms.length === 0) return undefined

  return terms.map((term) => {
    const contains = { contains: term, mode: 'insensitive' as const }
    return { OR: [{ name: contains }, { comment: contains }] }
  })
}

export const getExpenses = permissionAction({ payment: ['read'] })
  .metadata({ actionName: 'getExpenses' })
  .inputSchema(ExpenseListSchema)
  .action(async ({ ctx, parsedInput }): Promise<ExpenseListResult> => {
    const { page, pageSize, sort, search, from, to, amountMin, amountMax } = parsedInput

    const where: Prisma.ExpenseWhereInput = {
      organizationId: ctx.session.organizationId!,
      // Границы включительные и сравниваются как строки — `date` это date-only
      // колонка `YYYY-MM-DD`, где лексикографический порядок совпадает с
      // хронологическим.
      ...((from || to) && {
        date: { ...(from && { gte: from }), ...(to && { lte: to }) },
      }),
      // Пустой объект Prisma понимает как «поле есть», а не «ограничений нет», —
      // поэтому ключа при пустом диапазоне не появляется вовсе.
      ...((amountMin != null || amountMax != null) && {
        amount: {
          ...(amountMin != null && { gte: amountMin }),
          ...(amountMax != null && { lte: amountMax }),
        },
      }),
      AND: expenseSearchWhere(search),
    }

    // Одной транзакцией: строки, их количество и сумма обязаны быть посчитаны по
    // одному и тому же состоянию базы, иначе «страница 3 из 5» и итог под
    // таблицей разъедутся с тем, что реально вернулось.
    const [rows, total, sum] = await prisma.$transaction([
      prisma.expense.findMany({
        where,
        select: EXPENSE_LIST_SELECT,
        orderBy: resolveExpenseOrderBy(sort),
        skip: page * pageSize,
        take: pageSize,
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ])

    return { rows, total, amountTotal: sum._sum.amount ?? 0 }
  })

export const createExpense = authAction
  .metadata({ actionName: 'createExpense' })
  .inputSchema(CreateExpenseSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.expense.create({
      data: {
        ...parsedInput,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export const updateExpense = authAction
  .metadata({ actionName: 'updateExpense' })
  .inputSchema(UpdateExpenseSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, ...data } = parsedInput
    await prisma.expense.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data,
    })
  })

export const deleteExpense = authAction
  .metadata({ actionName: 'deleteExpense' })
  .inputSchema(DeleteExpenseSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.expense.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
