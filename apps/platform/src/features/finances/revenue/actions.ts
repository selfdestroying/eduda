'use server'

import { Prisma, prisma } from '@repo/db'
import { ForbiddenError } from '@/src/lib/error'
import { featureAction } from '@/src/lib/safe-action'
import { computeRevenue, computeRevenueGroups, revenueScopeWhere } from './compute.server'
import { RevenueChartSchema, RevenueGroupsSchema, RevenueListSchema } from './schemas'
import {
  REVENUE_LIST_SELECT,
  type RevenueChartPoint,
  type RevenueGroupsResult,
  type RevenueListResult,
} from './types'

/**
 * Выручка школы целиком — отчёт владельца. Гейт продублирован намеренно: боковое
 * меню прячет раздел, прокси закрывает маршрут при выключенной фиче, но экшен
 * зовётся и напрямую, и без этой проверки преподаватель прочитал бы выручку всей
 * школы.
 */
const revenueAction = featureAction('finances.revenue').use(async ({ next, ctx }) => {
  if (ctx.session.memberRole !== 'owner') {
    throw new ForbiddenError('Выручка доступна только владельцу')
  }
  return next()
})

type RevenueOrderBy = Prisma.AttendanceOrderByWithRelationInput

/**
 * Разрешённые колонки сортировки: id колонки → поля, по которым её сортировать.
 * Белый список, а не подстановка из запроса: `sort` приходит из адресной строки.
 *
 * Преподавателя здесь нет — их у урока может быть несколько, и SQL по такой
 * колонке не отсортирует; в таблице она объявлена без сортировки.
 */
const REVENUE_ORDER_BY: Record<string, (dir: Prisma.SortOrder) => RevenueOrderBy[]> = {
  date: (dir) => [{ lesson: { date: dir } }, { lesson: { time: dir } }],
  student: (dir) => [{ student: { firstName: dir } }, { student: { lastName: dir } }],
  amount: (dir) => [{ price: dir }],
  course: (dir) => [{ lesson: { group: { course: { name: dir } } } }],
  location: (dir) => [{ lesson: { group: { location: { name: dir } } } }],
}

/**
 * Порядок строк. Последним ключом всегда `id`: без него занятия одного дня при
 * листании переставляются местами, и одна отметка показывается на двух страницах
 * подряд.
 */
function resolveOrderBy(sort: { id: string; desc: boolean } | null | undefined): RevenueOrderBy[] {
  const build = sort ? REVENUE_ORDER_BY[sort.id] : undefined
  if (!sort || !build) return [{ lesson: { date: 'desc' } }, { id: 'desc' }]
  return [...build(sort.desc ? 'desc' : 'asc'), { id: 'desc' }]
}

/**
 * Выручка: занятия, за которые школа считает деньги заработанными (правило — в
 * `rule.ts`, запрос — в `compute.server.ts`), со срезом на страницу и итогами по
 * всему отбору.
 *
 * Занятие, попавшее в правило, но без цены, — проведённое и ещё не оплаченное:
 * оно остаётся в списке (иначе выручка молча теряет строки, которые никуда не
 * делись), но в сумму не входит и считается отдельно.
 */
export const getRevenue = revenueAction
  .metadata({ actionName: 'getRevenue' })
  .inputSchema(RevenueListSchema)
  .action(async ({ ctx, parsedInput }): Promise<RevenueListResult> => {
    const { page, pageSize, sort } = parsedInput
    const scope = { ...parsedInput, organizationId: ctx.session.organizationId! }
    const { where } = revenueScopeWhere(scope)

    // Одной транзакцией: строки и итоги обязаны быть посчитаны по одному состоянию
    // базы, иначе между запросами проходит отметка посещаемости и сумма не сходится
    // с тем, что показано в списке.
    const { rows, totals } = await prisma.$transaction(async (tx) => ({
      rows: await tx.attendance.findMany({
        where,
        select: REVENUE_LIST_SELECT,
        orderBy: resolveOrderBy(sort),
        skip: page * pageSize,
        take: pageSize,
      }),
      totals: await computeRevenue(scope, tx),
    }))

    return {
      rows,
      total: totals.attendanceCount,
      revenue: totals.revenue,
      paidCount: totals.paidCount,
    }
  })

/**
 * Сводка выручки: те же занятия, свёрнутые по выбранному измерению. Считает
 * `computeRevenueGroups`, здесь остаётся только нарезка на страницы.
 */
export const getRevenueGroups = revenueAction
  .metadata({ actionName: 'getRevenueGroups' })
  .inputSchema(RevenueGroupsSchema)
  .action(async ({ ctx, parsedInput }): Promise<RevenueGroupsResult> => {
    const { page, pageSize, sort, by } = parsedInput

    const { rows, ...totals } = await computeRevenueGroups({
      ...parsedInput,
      organizationId: ctx.session.organizationId!,
      by,
      sort,
    })

    return {
      rows: rows.slice(page * pageSize, page * pageSize + pageSize),
      // Строк столько, сколько получилось групп: из этого числа пагинация считает
      // страницы. Занятия живут отдельно, в `attendanceCount`.
      total: rows.length,
      ...totals,
    }
  })

/**
 * Выручка по дням — ряд для графика над таблицей. Та же свёртка `by: 'date'`, что
 * и в сводке, только без нарезки на страницы и без лишних полей строки.
 *
 * Разреза (неделя/месяц/год) здесь нет намеренно: выручка дня целиком принадлежит
 * одному дню, поэтому корзины любой крупности складываются из дневных чисел
 * обычным сложением — на клиенте, без похода на сервер за каждой вкладкой.
 */
export const getRevenueChart = revenueAction
  .metadata({ actionName: 'getRevenueChart' })
  .inputSchema(RevenueChartSchema)
  .action(async ({ ctx, parsedInput }): Promise<RevenueChartPoint[]> => {
    const { rows } = await computeRevenueGroups({
      ...parsedInput,
      organizationId: ctx.session.organizationId!,
      by: 'date',
      // По возрастанию: график складывает точки в корзины в порядке прихода и
      // сортировать их ещё раз не станет.
      sort: { id: 'date', desc: false },
    })

    return rows.map((row) => ({
      // При `by: 'date'` дата у строки есть всегда — она и есть ключ корзины.
      date: row.date!,
      revenue: row.revenue,
      paid: row.paid,
      total: row.total,
    }))
  })
