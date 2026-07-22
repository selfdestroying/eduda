import { Card, CardContent } from '@repo/ui/components/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/empty'
import { Trophy } from 'lucide-react'

export const metadata = { title: 'Достижения' }

// Заглушка по §2 SPEC: ачивок нет в БД ни в каком виде — ни таблиц, ни правил.
export default function AchievementsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Достижения</h1>
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>Скоро</EmptyTitle>
              <EmptyDescription>
                Здесь появятся награды за посещения и успехи в учёбе.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </div>
  )
}
