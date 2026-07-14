'use server'

import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { moscowTodayYmd } from '@/src/lib/timezone'
import { headers } from 'next/headers'

export const getActiveSessions = authAction
  .metadata({ actionName: 'getActiveSessions' })
  .action(async () => {
    return await auth.api.listSessions({
      headers: await headers(),
    })
  })

export const getMyPaychecks = authAction
  .metadata({ actionName: 'getMyPaychecks' })
  .action(async ({ ctx }) => {
    return await prisma.payCheck.findMany({
      where: {
        userId: Number(ctx.session.user.id),
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export type IncomeEntry = { date: string; lessons: number; paychecks: number }

export const getMyIncomeHistory = authAction
  .metadata({ actionName: 'getMyIncomeHistory' })
  .action(async ({ ctx }): Promise<IncomeEntry[]> => {
    const userId = Number(ctx.session.user.id)
    const organizationId = ctx.session.organizationId!

    const [teacherLessons, paychecks] = await Promise.all([
      prisma.teacherLesson.findMany({
        where: {
          teacherId: userId,
          organizationId,
          lesson: { status: 'ACTIVE', date: { lte: moscowTodayYmd() } },
        },
        select: {
          bid: true,
          bonusPerStudent: true,
          lesson: {
            select: {
              date: true,
              _count: { select: { attendance: { where: { status: 'PRESENT' } } } },
            },
          },
        },
      }),
      prisma.payCheck.findMany({
        where: { userId, organizationId },
        select: { date: true, amount: true },
      }),
    ])

    const map = new Map<string, IncomeEntry>()
    const upsert = (dateKey: string, key: 'lessons' | 'paychecks', amount: number) => {
      const e = map.get(dateKey) ?? { date: dateKey, lessons: 0, paychecks: 0 }
      e[key] += amount
      map.set(dateKey, e)
    }

    for (const tl of teacherLessons) {
      const present = tl.lesson._count?.attendance ?? 0
      const price = tl.bid + tl.bonusPerStudent * present
      upsert(tl.lesson.date, 'lessons', price)
    }
    for (const p of paychecks) {
      upsert(p.date, 'paychecks', p.amount)
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  })
