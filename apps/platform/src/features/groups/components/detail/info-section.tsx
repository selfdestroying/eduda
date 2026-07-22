'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import { formatDateOnly } from '@/src/lib/timezone'
import { DaysOfWeek } from '@/src/lib/utils'

import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/src/components/ui/item'
import {
  Archive,
  Book,
  Calendar,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Tag,
  Users,
} from 'lucide-react'
import type { GroupDetailFull } from '../../types'
import InfoSectionAction from './info-section-action'

type InactiveGroupStatus = Exclude<GroupDetailFull['status'], 'ACTIVE'>

const groupStatusConfig: Record<
  InactiveGroupStatus,
  {
    label: string
    Icon: typeof Archive
    itemClassName: string
    iconClassName: string
    descriptionClassName: string
  }
> = {
  ARCHIVED: {
    label: 'архивирована',
    Icon: Archive,
    itemClassName: '',
    iconClassName: '',
    descriptionClassName: '',
  },
  COMPLETED: {
    label: 'завершена',
    Icon: CheckCircle2,
    itemClassName: 'border-success/20 bg-success/10 text-success dark:bg-success/20',
    iconClassName: 'text-success',
    descriptionClassName: 'text-success/80',
  },
}

export default function InfoSection({
  group,
  canArchive,
}: {
  group: GroupDetailFull
  canArchive?: boolean
}) {
  const sortedSchedules = [...group.schedules].sort(
    (a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7),
  )
  const isActive = group.status === 'ACTIVE'
  const statusConfig = isActive ? null : groupStatusConfig[group.status as InactiveGroupStatus]

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Информация о группе</CardTitle>
        {isActive ? (
          <CardAction>
            <InfoSectionAction group={group} canArchive={canArchive} />
          </CardAction>
        ) : (
          <CardDescription>
            <Item variant="muted" className={statusConfig?.itemClassName}>
              <ItemMedia variant="icon" className={statusConfig?.iconClassName}>
                {statusConfig && <statusConfig.Icon />}
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  Группа {statusConfig?.label}{' '}
                  {group.statusChangedAt && formatDateOnly(group.statusChangedAt)}
                </ItemTitle>
                {group.statusComment && (
                  <ItemDescription className={statusConfig?.descriptionClassName}>
                    Комментарий: {group.statusComment}
                  </ItemDescription>
                )}
              </ItemContent>
            </Item>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 truncate sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <Book className="h-3 w-3" />
              <span className="truncate" title="Курс">
                Курс
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="truncate">{group.course.name}</div>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <Calendar className="h-3 w-3" />
              <span className="truncate" title="Расписание">
                Расписание
              </span>
            </div>
            <div className="flex flex-col gap-0.5 text-sm">
              {sortedSchedules.length > 0
                ? sortedSchedules.map((s) => (
                    <span key={s.id}>
                      {DaysOfWeek.full[s.dayOfWeek]} - {s.time}
                    </span>
                  ))
                : '-'}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <MapPin className="h-3 w-3" />
              <span className="truncate" title="Локация">
                Локация
              </span>
            </div>
            <div className="truncate">{group.location?.name}</div>
          </div>

          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <Tag className="h-3 w-3" />
              <span className="truncate" title="Тип">
                Тип
              </span>
            </div>
            <div className="truncate">{group.groupType?.name ?? '-'}</div>
          </div>

          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <Users className="h-3 w-3" />
              <span className="truncate" title="Количество учеников">
                Количество учеников
              </span>
            </div>
            <div className="truncate">
              {group.students.length}/{group.maxStudents}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <Calendar className="h-3 w-3" />
              <span className="truncate" title="Период">
                Период
              </span>
            </div>
            <div className="truncate">{formatDateOnly(group.startDate)}</div>
          </div>
          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <ExternalLink className="h-3 w-3" />
              <span className="truncate" title="Ссылка в amoCRM">
                Ссылка в БО
              </span>
            </div>
            <div className="text-primary truncate hover:underline">
              {group.url ? (
                <a href={group.url} target="_blank" rel="noopener noreferrer" title={group.url}>
                  {group.url}
                </a>
              ) : (
                '-'
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
