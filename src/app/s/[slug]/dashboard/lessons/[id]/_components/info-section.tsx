import { Prisma } from '@/prisma/generated/client'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { auth } from '@/src/lib/auth/server'
import { lessonStatusMap, lessonStatusVariants } from '@/src/lib/lesson-status'
import { formatDateOnly } from '@/src/lib/timezone'
import { getGroupName } from '@/src/lib/utils'
import { Book, Clock, MapPin, Users } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import EditLessonButton from './edit-lesson-button'

interface InfoSectionsProps {
  lesson: Prisma.LessonGetPayload<{
    include: {
      group: {
        include: {
          _count: { select: { students: true } }
          course: true
          location: true
        }
      }
      attendance: true
    }
  }>
}

export default async function InfoSection({ lesson }: InfoSectionsProps) {
  const requestHeaders = await headers()
  const { success: canEditLesson } = await auth.api.hasPermission({
    headers: requestHeaders,
    body: {
      permissions: { lesson: ['update'] },
    },
  })

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Информация об уроке</CardTitle>
        {canEditLesson && (
          <CardAction>
            <EditLessonButton lesson={lesson} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 truncate sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <Book className="h-3 w-3" />
              <span className="truncate" title="Курс">
                Группа
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link
                href={`/dashboard/groups/${lesson.group.id}`}
                className="text-primary truncate hover:underline"
              >
                {getGroupName(lesson.group)}
              </Link>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <Clock className="h-3 w-3" />
              <span className="truncate" title="Время">
                Время
              </span>
            </div>
            <div className="truncate">{lesson.time}</div>
          </div>

          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <Clock className="h-3 w-3" />
              <span className="truncate" title="Время">
                Дата
              </span>
            </div>
            <div className="truncate">{formatDateOnly(lesson.date)}</div>
          </div>

          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <MapPin className="h-3 w-3" />
              <span className="truncate" title="Локация">
                Локация
              </span>
            </div>
            <div className="truncate">{lesson.group.location?.name}</div>
          </div>

          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <Users className="h-3 w-3" />
              <span className="truncate" title="Количество учеников">
                Количество учеников
              </span>
            </div>
            <div className="truncate">
              {lesson.attendance.length}/{lesson.group.maxStudents}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
              <Users className="h-3 w-3" />
              <span className="truncate" title="Количество учеников">
                Статус
              </span>
            </div>
            <div className={lessonStatusVariants({ status: lesson.status })}>
              {lessonStatusMap[lesson.status]}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
