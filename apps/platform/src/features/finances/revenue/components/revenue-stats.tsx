'use client'

import { Hint } from '@/src/components/hint'
import { Card, CardContent } from '@/src/components/ui/card'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Banknote, TrendingUp } from 'lucide-react'
import type { RevenueStats } from '../types'
import { formatCurrency } from '@/src/lib/utils'

interface RevenueStatsCardsProps {
  stats: RevenueStats | undefined
  isLoading: boolean
}

function StatSkeleton() {
  return (
    <Card>
      <CardContent>
        <Skeleton className="mb-2 h-3 w-20" />
        <Skeleton className="h-8 w-24" />
      </CardContent>
    </Card>
  )
}

export default function RevenueStatsCards({ stats, isLoading }: RevenueStatsCardsProps) {
  if (isLoading) {
    return (
      <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatSkeleton />
          <StatSkeleton />
        </div>
      </>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-2">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Уроков
              </p>
              <Hint text="Общее количество уроков за выбранный период" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{stats.totalLessons}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Проведено
              </p>
              <Hint text="Уроки со статусом 'Активный' (не отменённые)" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{stats.doneLessons}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Посещаемость
              </p>
              <Hint text="Доля присутствовавших учеников от общего числа записей посещений" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{stats.attendanceRate}%</p>
            <p className="text-muted-foreground text-[0.5625rem]">
              {stats.presentCount} из {stats.totalStudentVisits}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Выручка
              </p>
              <Hint text="Сумма стоимости всех платных посещений за период" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(stats.totalRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <TrendingUp className="text-muted-foreground size-3" />
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Ср. за урок
              </p>
              <Hint text="Общая выручка, делённая на количество проведённых уроков" />
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(stats.avgPerLesson)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <Banknote className="text-muted-foreground size-3" />
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Ср. за посещение
              </p>
              <Hint text="Средняя стоимость одного платного посещения (Всего оплат / Всего уроков из кошелька ученика)" />
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(stats.avgPerVisit)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
