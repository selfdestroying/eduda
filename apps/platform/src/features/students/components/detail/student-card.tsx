'use client'

import { StatCard } from '@repo/ui/components/stat-card'
import { Separator } from '@repo/ui/components/separator'
import {
  Cake,
  CheckCircle2,
  Clock,
  ExternalLink,
  Link as LinkIcon,
  LucideIcon,
  User,
  UserRound,
} from 'lucide-react'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { formatDateOnly } from '@/src/lib/timezone'
import { getAgeFromBirthDate } from '@/src/lib/utils'
import type { StudentDetail } from '../../types'

interface StudentCardProps {
  student: StudentDetail
}

export default function StudentCard({ student }: StudentCardProps) {
  const tz = useOrgTimezone()
  // Возраст не хранится — считается из даты рождения в поясе школы.
  const age = student.birthDate ? getAgeFromBirthDate(student.birthDate, tz) : null
  const birthFormatted = student.birthDate
    ? formatDateOnly(student.birthDate, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const memberSince = new Date(student.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const actualizedAt = student.dataActualizedAt
    ? new Date(student.dataActualizedAt).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: tz,
      })
    : null

  return (
    <>
      {/* Общие сведения */}
      <SectionHeader title="Общие сведения" icon={User} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Возраст"
          value={age !== null ? `${age} лет` : 'Не указан'}
          icon={UserRound}
        />
        <StatCard label="Дата рождения" value={birthFormatted ?? 'Не указана'} icon={Cake} />
        <StatCard
          label="В системе с"
          value={memberSince}
          description={`Групп: ${student.groups.length}`}
        />
        <StatCard
          label="Актуальность данных"
          value={student.dataActual ? 'Подтверждены' : 'Не подтверждены'}
          description={actualizedAt ? `Дата: ${actualizedAt}` : 'Родитель ещё не подтвердил'}
          icon={student.dataActual ? CheckCircle2 : Clock}
        />
      </div>

      {student.url && (
        <>
          <Separator />

          {/* Ссылки и интеграции */}
          <SectionHeader title="Ссылки и интеграции" icon={LinkIcon} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Ссылка в CRM"
              value={
                <a
                  href={student.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  Открыть
                  <ExternalLink className="size-3" />
                </a>
              }
              icon={ExternalLink}
            />
          </div>
          <Separator />
        </>
      )}
    </>
  )
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
      <Icon size={20} />
      {title}
    </h3>
  )
}
