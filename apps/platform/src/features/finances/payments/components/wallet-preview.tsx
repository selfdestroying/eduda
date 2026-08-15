'use client'

import { STUDENT_STATUS } from '@/src/features/students/status'
import type { StudentStatus } from '@repo/db/enums'
import { Badge } from '@repo/ui/components/badge'
import { formatDate } from '@/src/lib/timezone'
import { formatCurrency, getGroupName } from '@/src/lib/utils'

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
 * кошельке уже есть. Пустой блок с пунктиром держит место, чтобы форма не
 * прыгала на высоту предпросмотра в момент выбора.
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
  if (!wallet) {
    return (
      <div className={`${BOX} text-muted-foreground border-dashed text-center`}>
        Кошелёк не выбран
      </div>
    )
  }

  const hiddenPayments = wallet._count.payments - wallet.payments.length

  return (
    // Части разделены линиями, а не отступами: в блоке из семи строк одного
    // расстояния мало, чтобы имя, группы и оплаты читались как разные вещи.
    <div className={`${BOX} divide-border flex flex-col divide-y`}>
      <div className="flex items-center justify-between gap-2 pb-2">
        <span className="truncate font-medium">{wallet.name || 'Без названия'}</span>
        {/* Главная цифра кошелька: сколько занятий у ученика на руках. Стрелка —
            каким остаток станет с этой оплатой, с поправкой на занятия, которые
            она закроет: сервер спишет их сразу (`settleUnpaidAttendancesTx`),
            и без поправки стрелка обещала бы остаток, которого не будет. */}
        <span className="text-muted-foreground shrink-0 tabular-nums">
          Остаток {wallet.lessonsBalance}
          {addedLessons
            ? ` → ${wallet.lessonsBalance + addedLessons - Math.min(unpaidLessons, addedLessons)}`
            : ''}
        </span>
      </div>

      {/* Долг объясняет, почему остаток вырастет не на всю оплату: эти занятия
          уже проведены, и оплата закроет их первыми. */}
      {unpaidLessons > 0 && <div className="text-warning py-2">{formatWaiting(unpaidLessons)}</div>}

      {/* Обе секции стоят всегда: пустая «Оплаты» — это сообщение, что кошелёк
          новый, а не повод убрать заголовок и оставить читателя гадать. */}
      <div className="flex flex-col gap-0.5 py-2">
        <span className={HEADING}>Группы</span>
        {wallet.studentGroups.length === 0 ? (
          <span className="text-muted-foreground">Нет групп</span>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {wallet.studentGroups.map((sg, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">{getGroupName(sg.group)}</span>
                <Badge variant={STUDENT_STATUS[sg.status].variant} className="shrink-0">
                  {STUDENT_STATUS[sg.status].label}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-0.5 pt-2">
        <span className={HEADING}>Оплаты</span>
        {wallet.payments.length === 0 ? (
          <span className="text-muted-foreground">Нет оплат</span>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {wallet.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 tabular-nums">
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
            {hiddenPayments > 0 && (
              <li className="text-muted-foreground">{formatMorePayments(hiddenPayments)}</li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
