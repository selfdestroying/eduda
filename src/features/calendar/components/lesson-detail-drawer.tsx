'use client'

import { Button } from '@/src/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerTitle,
} from '@/src/components/ui/drawer'
import { useLessonDetailQuery } from '@/src/features/lessons/queries'
import type { AttendanceWithStudents } from '@/src/features/lessons/types'
import { useIsMobile } from '@/src/hooks/use-mobile'
import { formatDateOnly } from '@/src/lib/timezone'
import { cn, getGroupName } from '@/src/lib/utils'
import {
  Armchair,
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
  Minus,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { CalendarController } from '../hooks/use-calendar'
import { DOW_FULL, MONTHS_GENITIVE } from '../lib/constants'
import { fmtTime, hexA, parseYmd } from '../lib/date-utils'
import type { CalendarEvent } from '../types'

// ─── Форматирование ──────────────────────────────────────────────────────────

/** `"2026-06-27"` → «суббота, 27 июня 2026». */
function fmtDate(ymd: string): string {
  const d = parseYmd(ymd)
  return `${DOW_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()}`
}

/** Минуты → «50 мин» / «1 ч 30 мин». */
function fmtDur(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return [h ? `${h} ч` : '', m ? `${m} мин` : ''].filter(Boolean).join(' ') || '0 мин'
}

// ─── Статусы посещаемости ──────────────────────────────────────────────────────

type UiStatus = 'present' | 'warned' | 'absent' | 'unspecified'

/** Доменный статус посещения → визуальный статус карточки. */
function uiStatus(a: AttendanceWithStudents): UiStatus {
  if (a.status === 'PRESENT') return 'present'
  if (a.status === 'ABSENT') return a.isWarned ? 'warned' : 'absent'
  return 'unspecified'
}

const STATUS_UI: Record<
  UiStatus,
  { label: string; icon: typeof Check; text: string; badge: string; bar: string }
> = {
  present: {
    label: 'Присутствовал',
    icon: Check,
    text: 'text-success',
    badge: 'text-success bg-success/10 border-success/20',
    bar: 'bg-success',
  },
  warned: {
    label: 'Предупредил',
    icon: BellRing,
    text: 'text-warning',
    badge: 'text-warning bg-warning/10 border-warning/20',
    bar: 'bg-warning',
  },
  absent: {
    label: 'Отсутствовал',
    icon: X,
    text: 'text-destructive',
    badge: 'text-destructive bg-destructive/10 border-destructive/20',
    bar: 'bg-destructive',
  },
  unspecified: {
    label: 'Не отмечен',
    icon: Minus,
    text: 'text-muted-foreground',
    badge: 'text-muted-foreground bg-muted border-border',
    bar: 'bg-muted-foreground/30',
  },
}

/** Порядок статусов для пилюль-счётчиков и сегментов полосы. */
const STATUS_ORDER: UiStatus[] = ['present', 'warned', 'absent', 'unspecified']

// ─── Мелкие части ──────────────────────────────────────────────────────────────

/** Поле меты: иконка + значение (подпись — только для a11y). */
function MetaItem({
  icon: Icon,
  label,
  value,
  full,
}: {
  icon: typeof Clock
  label: string
  value: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 items-start gap-2.5', full && 'col-span-2')}>
      <Icon
        className="text-muted-foreground/70 mt-px size-4 flex-none"
        strokeWidth={1.8}
        aria-label={label}
      />
      <div className="text-foreground min-w-0 text-[13.5px] leading-snug font-medium">{value}</div>
    </div>
  )
}

/** Связь с отработкой: пропустил → ссылка на урок-отработку; пришёл на отработку → ссылка на пропущенный. */
function makeupLink(a: AttendanceWithStudents) {
  if (a.makeupForAttendance)
    return {
      lessonId: a.makeupForAttendance.lessonId,
      label: `Отработка за ${formatDateOnly(a.makeupForAttendance.lesson!.date)}`,
    }
  if (a.makeupAttendance)
    return {
      lessonId: a.makeupAttendance.lessonId,
      label: `Отработка ${formatDateOnly(a.makeupAttendance.lesson!.date)}`,
    }
  return null
}

/** Строка ученика — целиком кнопка-ссылка на профиль (как кнопки футера). */
function StudentRow({ a }: { a: AttendanceWithStudents }) {
  const status = STATUS_UI[uiStatus(a)]
  const StatusIcon = status.icon
  const makeup = makeupLink(a)
  return (
    <Link
      href={`/students/${a.studentId}`}
      className="hover:bg-muted flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-medium">
            {a.student.firstName} {a.student.lastName}
          </span>
          {a.isTrial && (
            <span className="bg-info/10 text-info flex-none rounded px-1.5 py-px text-[10.5px] font-medium">
              Пробный
            </span>
          )}
        </div>
        {a.comment && (
          <div className="text-muted-foreground mt-0.5 truncate text-[12px]">{a.comment}</div>
        )}
        {makeup && (
          <div className="text-muted-foreground mt-0.5 truncate text-[12px]">{makeup.label}</div>
        )}
      </div>
      <StatusIcon
        className={cn('size-4 flex-none', status.text)}
        aria-label={status.label}
        role="img"
      />
      <ChevronRight className="text-muted-foreground/40 size-4 flex-none" />
    </Link>
  )
}

// ─── Содержимое карточки ────────────────────────────────────────────────────────

function LessonDetailBody({ ev }: { ev: CalendarEvent }) {
  const { data: detail, isLoading } = useLessonDetailQuery(ev.lessonId)

  const group = detail?.group
  const groupName = group ? getGroupName(group) : ev.title
  const groupType = group?.groupType?.name
  const maxStudents = group?.maxStudents
  const lessonTeachers = detail?.teachers.map((t) => t.teacher.name) ?? []
  const teacherNames = lessonTeachers.length ? lessonTeachers : ev.teachers.map((t) => t.name)

  const attendance = detail?.attendance ?? []
  const total = attendance.length
  const counts: Record<UiStatus, number> = { present: 0, warned: 0, absent: 0, unspecified: 0 }
  for (const a of attendance) counts[uiStatus(a)]++

  const duration = ev.end - ev.start

  return (
    <>
      {/* ── Шапка (фиксированная) ── */}
      <div className="flex-none border-b px-4 pt-4 pb-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-stretch gap-3">
            <span
              className="w-[5px] flex-none rounded-[3px]"
              style={{ background: ev.color }}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Урок
                </span>
                {groupType && (
                  <span
                    className="rounded-[5px] px-2 py-0.5 text-[11px] font-semibold"
                    style={{ color: ev.color, background: hexA(ev.color, 0.1) }}
                  >
                    {groupType}
                  </span>
                )}
              </div>
              <DrawerTitle
                className={cn(
                  'text-[20px] leading-tight font-bold tracking-[-0.02em]',
                  ev.cancelled && 'text-muted-foreground line-through',
                )}
              >
                {ev.title}
              </DrawerTitle>
              {ev.cancelled && (
                <span className="text-destructive mt-0.5 block text-[12px] font-medium">
                  Урок отменён
                </span>
              )}
            </div>
          </div>
          <DrawerClose
            aria-label="Закрыть"
            className="text-muted-foreground hover:bg-muted hover:text-foreground -mt-1 -mr-1 flex size-7 flex-none items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-4" />
          </DrawerClose>
        </div>

        {/* Сетка меты: дата и время — на всю ширину, остальное — половины */}
        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3.5">
          <MetaItem icon={CalendarDays} label="Дата" value={fmtDate(ev.date)} full />
          <MetaItem
            icon={Clock}
            label="Время"
            full
            value={
              <span className="tabular-nums">
                {fmtTime(ev.start)} – {fmtTime(ev.end)}
                <span className="text-muted-foreground"> · {fmtDur(duration)}</span>
              </span>
            }
          />
          <MetaItem
            icon={GraduationCap}
            label={teacherNames.length > 1 ? 'Преподаватели' : 'Преподаватель'}
            value={
              teacherNames.length ? (
                teacherNames.join(', ')
              ) : (
                <span className="text-muted-foreground">Не назначен</span>
              )
            }
          />
          {ev.location && <MetaItem icon={MapPin} label="Локация" value={ev.location} />}
          <MetaItem icon={Users} label="Группа" value={groupName} />
          {maxStudents != null && (
            <MetaItem
              icon={Armchair}
              label="Места"
              value={
                <span className="tabular-nums">
                  {total} / {maxStudents} мест
                </span>
              }
            />
          )}
        </div>
      </div>

      {/* ── Посещаемость + ростер ── */}
      <div className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <div className="text-muted-foreground py-6 text-center text-[13px]">Загрузка…</div>
        ) : total === 0 ? (
          <div className="text-muted-foreground py-6 text-center text-[13px]">
            Нет учеников на уроке
          </div>
        ) : (
          <>
            {/* Сводка (фиксированная) */}
            <div className="flex-none px-4 pt-3.5 pb-3">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] font-semibold">Посещаемость</span>
                  <span className="text-muted-foreground text-[12.5px] tabular-nums">
                    {counts.present} из {total} пришли
                  </span>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => {
                    const Icon = STATUS_UI[s].icon
                    return (
                      <span
                        key={s}
                        title={STATUS_UI[s].label}
                        className={cn(
                          'flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                          STATUS_UI[s].badge,
                        )}
                      >
                        <Icon className="size-3" />
                        {counts[s]}
                      </span>
                    )
                  })}
                </div>
              </div>
              {/* Сегментированная полоса распределения */}
              <div className="bg-muted flex h-1.5 overflow-hidden rounded-full">
                {STATUS_ORDER.filter((s) => s !== 'unspecified').map((s) => (
                  <span
                    key={s}
                    className={STATUS_UI[s].bar}
                    style={{ width: `${(counts[s] / total) * 100}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Ростер (прокручиваемый) */}
            <div className="thin-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto px-3 pt-1 pb-3">
              {attendance.map((a) => (
                <StudentRow key={a.id} a={a} />
              ))}
            </div>
          </>
        )}
      </div>

      <DrawerFooter>
        <Button
          variant="outline"
          render={<Link href={`/lessons/${ev.lessonId}`} />}
          nativeButton={false}
        >
          Открыть урок <ArrowRight />
        </Button>
        <Button
          variant="outline"
          render={<Link href={`/groups/${ev.groupId}`} />}
          nativeButton={false}
        >
          Открыть группу <ArrowRight />
        </Button>
      </DrawerFooter>
    </>
  )
}

/**
 * Drawer с подробностями урока — показывается при клике на событие календаря.
 * Снизу на мобильных, справа на десктопе (как `FiltersDrawer`).
 */
export function LessonDetailDrawer({ ctrl }: { ctrl: CalendarController }) {
  const isMobile = useIsMobile()
  // Сохраняем последнее событие, чтобы содержимое не исчезало на анимации закрытия.
  const [shown, setShown] = useState<CalendarEvent | null>(null)
  useEffect(() => {
    if (ctrl.selectedEvent) setShown(ctrl.selectedEvent)
  }, [ctrl.selectedEvent])
  const ev = ctrl.selectedEvent ?? shown

  return (
    <Drawer
      direction={isMobile ? 'bottom' : 'right'}
      open={ctrl.selectedEvent !== null}
      onOpenChange={(open) => !open && ctrl.closeEvent()}
    >
      <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-[484px]">
        {ev && <LessonDetailBody ev={ev} />}
      </DrawerContent>
    </Drawer>
  )
}
