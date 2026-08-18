'use client'

import { STUDENT_STATUS } from '@/src/features/students/status'
import type { StudentStatus } from '@repo/db/enums'
import { Badge } from '@repo/ui/components/badge'
import { formatDate } from '@/src/lib/timezone'
import { formatCurrency, getGroupName } from '@/src/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

/** «1 занятие ждёт оплаты», «3 занятия ждут оплаты». */
function formatWaiting(count: number) {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return `${count} занятий ждут оплаты`
  if (mod10 === 1) return `${count} занятие ждёт оплаты`
  if (mod10 >= 2 && mod10 <= 4) return `${count} занятия ждут оплаты`
  return `${count} занятий ждут оплаты`
}

/** «ещё 1 оплата», «ещё 3 оплаты», «ещё 7 оплат». */
function formatMorePayments(count: number) {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return `ещё ${count} оплат`
  if (mod10 === 1) return `ещё ${count} оплата`
  if (mod10 >= 2 && mod10 <= 4) return `ещё ${count} оплаты`
  return `ещё ${count} оплат`
}

/**
 * Строки обеих секций. Высота задана явно и равна высоте `Badge` (`h-5`): бейдж
 * статуса выше строки текста, и без этого строка с группой была бы выше строки с
 * оплатой, а обе — выше распорки. Всё остальное центрируется внутри.
 */
const ROWS = '[&>li]:flex [&>li]:h-5 [&>li]:items-center'

/**
 * Появление строки, раскрытой шевроном: лесенкой, по порядку. Первая строка секции
 * была на экране и в свёрнутом виде — её не трогаем, иначе раскрытие выглядело бы
 * как подмена всего списка. `animate-tab-enter` уже умеет prefers-reduced-motion,
 * поэтому своей проверки здесь нет.
 */
function revealRow(index: number) {
  if (index < 1) return { className: '', style: undefined }
  return { className: ' animate-tab-enter', style: { animationDelay: `${index * 40}ms` } }
}

/**
 * Ровно те поля, которые показывает предпросмотр. Структурный тип, а не вывод из
 * запроса: так видно с одного взгляда, что блоку нужно, и он не ломается от
 * каждой правки `select`.
 */
export interface WalletPreviewData {
  name: string | null
  lessonsBalance: number
  studentGroups: Array<{
    status: StudentStatus
    group: {
      name: string | null
      course: { name: string }
      schedules: Array<{ dayOfWeek: number; time: string }>
    }
  }>
  payments: Array<{
    id: number
    date: string
    price: number
    lessonCount: number
    /** `null` у пакетов, заведённых до появления очереди остатков. */
    remaining: number | null
  }>
  _count: { payments: number }
}

const BOX = 'rounded-md border p-2.5 text-xs'

/** Та же подпись раздела, что у секций в панели фильтров таблицы. */
const HEADING = 'text-muted-foreground text-[11px] font-semibold tracking-wide uppercase'

/**
 * Кошелёк одним блоком под полем выбора: во что превратится оплата и что в этом
 * кошельке уже есть.
 *
 * Свёрнутый блок — одна строка на секцию, и его высота не зависит от выбранного
 * кошелька: он стоит посреди формы, и прыжок при смене уводил бы поля из-под
 * курсора. Отсюда распорка вместо недостающей строки, строка долга внутри шапки
 * (отдельной секцией она принесла бы с собой ещё и разделительную линию) и шеврон
 * раскрытия там же — он держит своё место даже когда разворачивать нечего.
 */
export function WalletPreview({
  wallet,
  addedLessons,
  unpaidLessons = 0,
}: {
  wallet: WalletPreviewData | null
  /** Занятия из заполняемой оплаты — чтобы показать, каким станет остаток. */
  addedLessons?: number
  /** Проведённые занятия кошелька, которые эта оплата закроет. */
  unpaidLessons?: number
}) {
  // Развёрнутое состояние переживает смену кошелька: раскрыв его один раз, человек
  // обычно сравнивает кошельки как раз по этим спискам.
  const [expanded, setExpanded] = useState(false)

  const groups = wallet?.studentGroups ?? []
  const payments = wallet?.payments ?? []
  const totalPayments = wallet?._count.payments ?? 0

  // Свёрнутый вид — по одной, самой свежей строке. Развёрнутый показывает все
  // группы и те оплаты, что приехали с сервера (`take: 2`); остальные считаются в
  // «ещё N» — ради них отдельный запрос не делаем.
  const shownGroups = expanded ? groups : groups.slice(0, 1)
  const shownPayments = expanded ? payments : payments.slice(0, 1)
  const hiddenPayments = totalPayments - shownPayments.length

  const canExpand = groups.length > 1 || totalPayments > 1

  return (
    // Части разделены линиями, а не отступами: одного расстояния мало, чтобы имя,
    // группы и оплаты читались как разные вещи — тем более в развёрнутом виде.
    // Пунктир — знак, что кошелёк ещё не выбран, а размер тот же.
    <div className={`${BOX} divide-border flex flex-col divide-y ${wallet ? '' : 'border-dashed'}`}>
      <div className="flex flex-col gap-0.5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate font-medium ${wallet ? '' : 'text-muted-foreground'}`}>
            {wallet ? wallet.name || 'Без названия' : 'Кошелёк не выбран'}
          </span>
          {/* Раскрытие живёт здесь, а не отдельной строкой внизу: строка шапки в
              блоке есть всегда и всегда одной высоты, а отдельная стоила бы ещё и
              разделительной линии — почти столько же, сколько экономит свёрнутый
              вид. Иконка ровно в строку текста (16px), поэтому шапка от неё не
              растёт. Разворачивать нечего — место всё равно занято: иначе
              свёрнутый блок менял бы высоту от кошелька к кошельку. */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            disabled={!canExpand}
            aria-label={expanded ? 'Свернуть' : 'Показать все группы и оплаты'}
            className={`text-muted-foreground hover:text-foreground shrink-0 transition-colors ${
              canExpand ? '' : 'invisible'
            }`}
          >
            <ChevronDown
              className={`size-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        {/* Вторая строка шапки: цифры кошелька. Имя наверху бывает длинным, и вместе
            с остатком они делили одну строку впритык — на телефоне название
            обрезалось первым. Долг встаёт справа от остатка, а не третьей строкой:
            он же его и объясняет. */}
        <div className="flex items-center justify-between gap-2">
          {/* Главная цифра кошелька: сколько занятий у ученика на руках. Стрелка —
              каким остаток станет с этой оплатой, с поправкой на занятия, которые
              она закроет: сервер спишет их сразу (`settleUnpaidAttendancesTx`),
              и без поправки стрелка обещала бы остаток, которого не будет.
              Пока кошелёк не выбран, строку держит пробел — высота та же. */}
          {wallet ? (
            <span className="text-muted-foreground tabular-nums">
              Остаток {wallet.lessonsBalance}
              {addedLessons
                ? ` → ${wallet.lessonsBalance + addedLessons - Math.min(unpaidLessons, addedLessons)}`
                : ''}
            </span>
          ) : (
            <span aria-hidden className="select-none">
              &nbsp;
            </span>
          )}
          {/* Долг объясняет, почему остаток вырастет не на всю оплату: эти занятия
              уже проведены, и оплата закроет их первыми. */}
          {unpaidLessons > 0 && (
            <span className="text-warning shrink-0">{formatWaiting(unpaidLessons)}</span>
          )}
        </div>
      </div>

      {/* Обе секции стоят всегда: пустая «Оплаты» — это сообщение, что кошелёк
          новый, а не повод убрать заголовок и оставить читателя гадать. Число в
          заголовке говорит, сколько скрыто, не тратя на это строку. */}
      <div className="flex flex-col gap-0.5 py-2">
        <SectionHeading title="Группы" count={groups.length} />
        <ul className={`flex flex-col gap-0.5 ${ROWS}`}>
          {wallet && groups.length === 0 && <li className="text-muted-foreground">Нет групп</li>}
          {shownGroups.map((sg, i) => (
            <li
              key={i}
              className={`flex items-center justify-between gap-2${revealRow(i).className}`}
              style={revealRow(i).style}
            >
              <span className="truncate">{getGroupName(sg.group)}</span>
              <Badge variant={STUDENT_STATUS[sg.status].variant} className="shrink-0">
                {STUDENT_STATUS[sg.status].label}
              </Badge>
            </li>
          ))}
          {/* Пока кошелёк не выбран, строку держит распорка — рамка та же по высоте. */}
          {!wallet && <li aria-hidden />}
        </ul>
      </div>

      <div className="flex flex-col gap-0.5 pt-2">
        <SectionHeading title="Оплаты" count={totalPayments} />
        <ul className={`flex flex-col gap-0.5 ${ROWS}`}>
          {wallet && payments.length === 0 && <li className="text-muted-foreground">Нет оплат</li>}
          {shownPayments.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center justify-between gap-2 tabular-nums${revealRow(i).className}`}
              style={revealRow(i).style}
            >
              <span className="truncate">
                {formatDate(p.date)} · {formatCurrency(p.price)}
              </span>
              {/* Остаток к размеру пакета: «4/8» — из восьми занятий не потрачено
                  четыре. Само число занятий из левой части ушло, чтобы не стоять
                  в строке дважды. */}
              <span className="text-muted-foreground shrink-0">
                {p.remaining ?? '—'}/{p.lessonCount}
              </span>
            </li>
          ))}
          {expanded && hiddenPayments > 0 && (
            <li
              className={`text-muted-foreground${revealRow(shownPayments.length).className}`}
              style={revealRow(shownPayments.length).style}
            >
              {formatMorePayments(hiddenPayments)}
            </li>
          )}
          {!wallet && <li aria-hidden />}
        </ul>
      </div>
    </div>
  )
}

/** Заголовок секции со счётчиком: «ОПЛАТЫ 5». Единица не показывается — считать нечего. */
function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <span className={HEADING}>
      {title}
      {count > 1 && <span className="ml-1 tabular-nums opacity-70">{count}</span>}
    </span>
  )
}
