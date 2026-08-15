'use client'

import { Separator } from '@repo/ui/components/separator'
import { formatDate } from '@/src/lib/timezone'
import { formatCurrency, getGroupName } from '@/src/lib/utils'

/** «1 занятие», «2 занятия», «5 занятий». */
function formatLessons(count: number) {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return `${count} занятий`
  if (mod10 === 1) return `${count} занятие`
  if (mod10 >= 2 && mod10 <= 4) return `${count} занятия`
  return `${count} занятий`
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
  totalLessons: number
  totalPayments: number
  studentGroups: Array<{
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
export function WalletPreview({ wallet }: { wallet: WalletPreviewData | null }) {
  if (!wallet) {
    return (
      <div className={`${BOX} text-muted-foreground border-dashed text-center`}>
        Кошелёк не выбран
      </div>
    )
  }

  const hiddenPayments = wallet._count.payments - wallet.payments.length

  return (
    <div className={`${BOX} flex flex-col gap-2`}>
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{wallet.name || 'Без названия'}</span>
        <div className="text-muted-foreground flex h-4 items-center gap-2 tabular-nums">
          {formatLessons(wallet.totalLessons)}
          <Separator orientation="vertical" />
          {formatCurrency(wallet.totalPayments)}
        </div>
      </div>

      {wallet.studentGroups.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className={HEADING}>Группы</span>
          <ul className="text-muted-foreground flex flex-col gap-0.5">
            {wallet.studentGroups.map((sg, i) => (
              <li key={i} className="truncate">
                {getGroupName(sg.group)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {wallet.payments.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className={HEADING}>Оплаты</span>
          <ul className="flex flex-col gap-0.5">
            {wallet.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 tabular-nums">
                <span className="truncate">
                  {formatDate(p.date)} · {p.lessonCount} зан. · {formatCurrency(p.price)}
                </span>
                <span className="text-muted-foreground shrink-0">остаток {p.remaining ?? '—'}</span>
              </li>
            ))}
            {hiddenPayments > 0 && (
              <li className="text-muted-foreground">{formatMorePayments(hiddenPayments)}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
