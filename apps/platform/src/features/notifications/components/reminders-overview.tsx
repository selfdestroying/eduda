'use client'

import ChartTabs from '@/src/components/chart-tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { useState } from 'react'
import ReminderLogTable from './reminder-log-table'
import ReminderParentsTable from './reminder-parents-table'

/**
 * Экран школы: два списка. Вкладками, а не двумя карточками подряд — вопросы у
 * них разные и одновременно не задаются.
 *
 * Разрез переключается `ChartTabs`, как над графиками, и таблица под ним
 * рисуется ветвлением, а не `TabsContent`: соседняя так и не монтируется и на
 * сервер впустую не ходит.
 */

const TAB_LABEL = {
  parents: 'Родители',
  log: 'Журнал отправок',
} as const

export default function RemindersOverview() {
  const [tab, setTab] = useState<keyof typeof TAB_LABEL>('parents')

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle>Как идут напоминания</CardTitle>
          <CardDescription>
            «Родители» — кто подключил бота и кого стоит дожать; «Журнал» — что ушло, что нет и по
            какой причине.
          </CardDescription>
        </div>
        <ChartTabs value={tab} onValueChange={setTab} labels={TAB_LABEL} />
      </CardHeader>

      <CardContent>
        {tab === 'parents' ? <ReminderParentsTable /> : <ReminderLogTable />}
      </CardContent>
    </Card>
  )
}
