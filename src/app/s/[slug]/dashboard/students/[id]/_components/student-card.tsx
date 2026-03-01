import { Separator } from '@/src/components/ui/separator'
import { StatCard } from '@/src/components/ui/stat-card'
import {
  Cake,
  Coins,
  ExternalLink,
  KeyRound,
  Link as LinkIcon,
  Lock,
  LucideIcon,
  Phone,
  User,
  UserRound,
} from 'lucide-react'
import AddCoinsForm from './add-coins-form'
import { StudentWithGroupsAndAttendance } from './types'

interface StudentCardProps {
  student: StudentWithGroupsAndAttendance
}

export default async function StudentCard({ student }: StudentCardProps) {
  const birthFormatted = student.birthDate
    ? new Date(student.birthDate).toLocaleDateString('ru-RU', {
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

  return (
    <>
      {/* Общие сведения */}
      <SectionHeader title="Общие сведения" icon={User} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Возраст"
          value={student.age ? `${student.age} лет` : 'Не указан'}
          icon={UserRound}
        />
        <StatCard label="Дата рождения" value={birthFormatted ?? 'Не указана'} icon={Cake} />
        <StatCard
          label="В системе с"
          value={memberSince}
          description={`Групп: ${student.groups.length}`}
        />
      </div>

      <Separator />

      {/* Учётная запись */}
      <SectionHeader title="Учётная запись" icon={Lock} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Логин" value={student.login} icon={User} />
        <StatCard label="Пароль" value={student.password} icon={KeyRound} />
        <div className="bg-muted/50 relative overflow-hidden rounded-lg p-3 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs font-medium">Астрокоины</span>
            <Coins className="text-muted-foreground size-4 shrink-0" />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">{student.coins ?? 0}</span>
            <AddCoinsForm studentId={student.id} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Родители */}
      <SectionHeader title="Родители" icon={User} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="ФИО Родителя"
          value={student.parentsName ?? 'Не указано'}
          icon={UserRound}
        />
        <StatCard
          label="Телефон"
          value={
            student.parentsPhone ? (
              <div className="flex flex-col gap-1.5">
                <a href={`tel:${student.parentsPhone}`} className="text-primary hover:underline">
                  {student.parentsPhone}
                </a>
                <div className="flex gap-1.5">
                  <a
                    href={`https://wa.me/${student.parentsPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-background inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.625rem] font-medium text-emerald-600 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:ring-emerald-800 dark:hover:bg-emerald-950/40"
                  >
                    <svg viewBox="0 0 24 24" className="size-3 fill-current">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.553 4.126 1.522 5.862L.054 23.65a.5.5 0 0 0 .611.611l5.788-1.468A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 0 1-5.39-1.584l-.386-.232-3.436.871.87-3.436-.232-.386A9.94 9.94 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                    </svg>
                    WhatsApp
                  </a>
                  <a
                    href={`https://t.me/${student.parentsPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-background inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.625rem] font-medium text-sky-600 ring-1 ring-sky-200 transition-colors hover:bg-sky-50 dark:text-sky-400 dark:ring-sky-800 dark:hover:bg-sky-950/40"
                  >
                    <svg viewBox="0 0 24 24" className="size-3 fill-current">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    Telegram
                  </a>
                </div>
              </div>
            ) : (
              'Не указан'
            )
          }
          icon={Phone}
        />
      </div>

      <Separator />

      {/* Ссылки и интеграции */}
      <SectionHeader title="Ссылки и интеграции" icon={LinkIcon} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Ссылка в CRM"
          value={
            student.url ? (
              <a
                href={student.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 hover:underline"
              >
                Открыть
                <ExternalLink className="size-3" />
              </a>
            ) : (
              'Не указано'
            )
          }
          icon={ExternalLink}
        />
      </div>

      <Separator />
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
