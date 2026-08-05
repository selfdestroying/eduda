'use server'

import { ConflictError, NotFoundError } from '@/src/lib/error'
import { studentAction } from '@/src/lib/safe-action'
import { prisma } from '@repo/db'
import { CoinTxReason, Prisma } from '@repo/db'
import * as z from 'zod'
import type { GroupId } from './registry'
import { ACHIEVEMENTS, claimedLevel, hasAnyClaim, tierKey } from './registry'
import { collectStats } from './stats'

/**
 * Карточка достижения. Всегда описывает БЛИЖАЙШИЙ незабранный уровень; когда
 * забраны все, карточка становится «получено» и показывает последний.
 */
export type AchievementView = {
  key: string
  group: GroupId
  /** Название уровня: «Постоянный», «Ветеран», … */
  title: string
  hint: string
  coins: number
  current: number
  target: number
  /** Забранных уровней и всего уровней — для подписи «Уровень 2 из 4». */
  level: number
  levels: number
  claimed: { at: Date; coins: number } | null
}

/**
 * Достижения ученика.
 *
 * Намеренно `studentAction`, а не `shopAction`: коины начисляются за учёбу, и
 * выключенный школой магазин не должен прятать награды — так же, как не прячет
 * историю заказов.
 */
export const getAchievements = studentAction
  .metadata({ actionName: 'getAchievements' })
  .action(async ({ ctx }): Promise<AchievementView[]> => {
    const { id: studentId, organizationId } = ctx.student
    const stats = await collectStats(prisma, studentId, organizationId, ctx.org.timezone)

    return ACHIEVEMENTS.flatMap((achievement) => {
      const levels = achievement.tiers.length
      const level = claimedLevel(achievement, stats)
      const done = level >= levels

      // Показываем последний забранный уровень, а если не забрано ничего —
      // ближайший доступный.
      const tier = achievement.tiers[done ? levels - 1 : level]!
      const key = tierKey(achievement, stats, done ? levels - 1 : level)

      // Недоступное и ни разу не забранное не показываем вовсе: подарок ко дню
      // рождения у ученика без даты — это не «0 из 1», а пустое место.
      if (!key && !hasAnyClaim(achievement, stats)) return []

      const previous = key ? stats.claimed.get(key) : undefined

      return [
        {
          key: achievement.key,
          group: achievement.group,
          title: tier.title,
          hint: achievement.hint(tier.target),
          coins: tier.coins,
          current: Math.min(achievement.value(stats), tier.target),
          target: tier.target,
          level,
          levels,
          claimed: previous ? { at: previous.claimedAt, coins: previous.coins } : null,
        },
      ]
    })
  })

/**
 * Забрать ближайший доступный уровень достижения.
 *
 * Клиент присылает ТОЛЬКО ключ достижения: и уровень, и размер награды сервер
 * определяет сам, иначе достижения фармились бы из консоли браузера.
 *
 * Запись достижения, начисление коинов и строка леджера идут одной транзакцией —
 * инвариант «сумма леджера = `StudentAccount.coins`» иначе разъедется. Повторный
 * клик и вторая вкладка ловятся уникальным индексом `(studentId, key)`: обычный
 * `create`, а нарушение уникальности и есть ответ «уже забрал».
 */
export const claimAchievement = studentAction
  .metadata({ actionName: 'claimAchievement' })
  .inputSchema(z.object({ key: z.string().min(1) }))
  .action(async ({ ctx, parsedInput }) => {
    const { id: studentId, organizationId } = ctx.student
    const achievement = ACHIEVEMENTS.find((a) => a.key === parsedInput.key)
    if (!achievement) throw new NotFoundError('Достижение не найдено')

    try {
      return await prisma.$transaction(async (tx) => {
        const stats = await collectStats(tx, studentId, organizationId, ctx.org.timezone)

        const level = claimedLevel(achievement, stats)
        const tier = achievement.tiers[level]
        if (!tier) throw new ConflictError('Все уровни этого достижения уже получены')

        const key = tierKey(achievement, stats, level)
        if (!key || achievement.value(stats) < tier.target) {
          throw new ConflictError('Достижение ещё не выполнено')
        }

        await tx.studentAchievement.create({
          data: { studentId, organizationId, key, coins: tier.coins },
        })

        // `updateMany`, а не `update`: `StudentAccount` ищется по паре с
        // организацией, как и всё остальное в кабинете.
        const { count } = await tx.studentAccount.updateMany({
          where: { studentId, organizationId },
          data: { coins: { increment: tier.coins } },
        })
        if (count !== 1) throw new NotFoundError('Счёт ученика не найден')

        await tx.coinTransaction.create({
          data: {
            organizationId,
            studentId,
            amount: tier.coins,
            reason: CoinTxReason.ACHIEVEMENT_CLAIM,
          },
        })

        return { coins: tier.coins, title: tier.title }
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' // нарушен @@unique([studentId, key])
      ) {
        throw new ConflictError('Это достижение уже получено')
      }
      throw error
    }
  })
