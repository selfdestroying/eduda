'use client'

import { cn } from '@/src/lib/utils'
import type { CalendarController } from '../../hooks/use-calendar'
import { DAY_STATUS_COLORS, DOW_FULL, DOW_NARROW, MON_SHORT, NOW_COLOR } from '../../lib/constants'
import { dowOrder, monthGrid, parseYmd, sortEvents, todayYmd, ymd } from '../../lib/date-utils'
import { AgendaRow } from './agenda-row'

const lessonsWord = (n: number) => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'урок'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'урока'
  return 'уроков'
}

function MonthCell({ ctrl, day, month }: { ctrl: CalendarController; day: Date; month: number }) {
  const ds = ymd(day)
  const inMonth = day.getMonth() === month
  const isToday = ds === todayYmd()
  const selected = ds === ctrl.currentDate
  // Точка статуса посещаемости: зелёная/красная; серая — будущий день или уроки отменены.
  const status = ctrl.dayStatus(ds)
  const hasEvents = ctrl.eventsOn(ds).length > 0

  return (
    <button
      onClick={() => ctrl.setCurrentDate(ds)}
      className="flex flex-col items-center gap-[3px] pt-1.5 pb-[5px]"
    >
      <span
        className={cn(
          'flex size-[30px] items-center justify-center rounded-full text-[14px] tabular-nums',
          isToday || selected ? 'font-semibold' : 'font-normal',
          selected && isToday && 'bg-primary text-primary-foreground',
          selected && !isToday && 'bg-muted text-foreground',
          !selected && !isToday && (inMonth ? 'text-foreground' : 'text-muted-foreground/70'),
        )}
        style={!selected && isToday ? { color: NOW_COLOR } : undefined}
      >
        {day.getDate()}
      </span>
      <div className="flex h-[5px] items-center">
        {hasEvents && (
          <span
            className="size-[5px] rounded-full"
            style={{
              background: status ? DAY_STATUS_COLORS[status] : 'var(--muted-foreground)',
            }}
          />
        )}
      </div>
    </button>
  )
}

function DayAgenda({ ctrl }: { ctrl: CalendarController }) {
  const ds = ctrl.currentDate
  const evs = ctrl.eventsOn(ds).sort(sortEvents)
  const d = parseYmd(ds)
  const isToday = ds === todayYmd()
  const status = ctrl.dayStatus(ds)

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-auto pb-28">
      <div className="bg-card sticky top-0 z-1 flex items-baseline gap-2 px-[18px] pt-3.5 pb-2">
        {status && (
          <span
            className="size-[5px] flex-none self-center rounded-full"
            style={{ background: DAY_STATUS_COLORS[status] }}
          />
        )}
        <span
          className={cn('text-[15px] font-bold tracking-tight', !isToday && 'text-foreground')}
          style={isToday ? { color: NOW_COLOR } : undefined}
        >
          {DOW_FULL[d.getDay()]}, {d.getDate()} {MON_SHORT[d.getMonth()]}
        </span>
        {evs.length > 0 && (
          <span className="text-muted-foreground/70 text-[12.5px]">
            {evs.length} {lessonsWord(evs.length)}
          </span>
        )}
      </div>
      {evs.length > 0 ? (
        evs.map((ev) => <AgendaRow key={ev.id} ev={ev} onClick={() => ctrl.selectEvent(ev)} />)
      ) : (
        <div className="text-muted-foreground/70 px-[18px] py-6 text-center text-[13.5px]">
          Нет уроков
        </div>
      )}
    </div>
  )
}

export function MobileMonthView({ ctrl }: { ctrl: CalendarController }) {
  const c = ctrl.curr
  const m = c.getMonth()
  const cells = monthGrid(c.getFullYear(), m, ctrl.weekStart)
  const order = dowOrder(ctrl.weekStart)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 px-1.5 pt-2 pb-1">
        {order.map((di, i) => (
          <div key={i} className="text-muted-foreground/70 text-center text-[11px] font-semibold">
            {DOW_NARROW[di]}
          </div>
        ))}
      </div>
      <div className="grid flex-none grid-cols-7 border-b px-1.5 pb-2.5">
        {cells.map((day) => (
          <MonthCell key={ymd(day)} ctrl={ctrl} day={day} month={m} />
        ))}
      </div>
      <DayAgenda ctrl={ctrl} />
    </div>
  )
}
