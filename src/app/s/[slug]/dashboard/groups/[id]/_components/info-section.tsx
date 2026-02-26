import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { DaysOfWeek } from '@/src/lib/utils'
import { GroupDTO } from '@/src/types/group'
import { formatDateOnly } from '@/src/lib/timezone'
import { Book, Calendar, ExternalLink, MapPin, Tag, Users } from 'lucide-react'
import EditGroupButton from './edit-group-button'

export default async function InfoSection({ group }: { group: GroupDTO }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Информация о группе</CardTitle>
        <CardAction>
          <EditGroupButton group={group} />
        </CardAction>
      </CardHeader>
      <CardContent>
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
            <div className="flex flex-col gap-0.5">
              {group.schedules && group.schedules.length > 0
                ? [...group.schedules]
                    .sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7))
                    .map((s) => (
                      <span key={s.id} className="truncate">
                        {DaysOfWeek.full[s.dayOfWeek]} - {s.time}
                      </span>
                    ))
                : group.dayOfWeek != null
                  ? `${DaysOfWeek.full[group.dayOfWeek]} - ${group.time}`
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
