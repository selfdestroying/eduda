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

/** «ещё 1 группа», «ещё 3 группы», «ещё 7 групп». */
function formatMoreGroups(count: number) {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return `ещё ${count} групп`
  if (mod10 === 1) return `ещё ${count} группа`
  if (mod10 >= 2 && mod10 <= 4) return `ещё ${count} группы`
  return `ещё ${count} групп`
}

/**
 * Сколько строк отведено каждой секции. Высота блока не должна зависеть от того,
 * какой кошелёк выбран: он стоит посреди формы, и прыжок на строку-другую при смене
 * уводит поля из-под курсора. Поэтому не «сколько получилось», а всегда столько:
 * лишнее сворачивается в «ещё N», недостающее добирается пустыми строками.
 *
 * Три — потому что сервер отдаёт две последние оплаты (`getStudentWallets`), и с
 * «ещё N» это ровно три.
 */
const ROW_SLOTS = 3

/**
 * Строки обеих секций. Высота задана явно и равна высоте `Badge` (`h-5`): бейдж
 * статуса выше строки текста, и без этого строка с группой была бы выше строки с
 * оплатой, а обе — выше распорки. Всё остальное центрируется внутри.
 */
const ROWS = '[&>li]:flex [&>li]:h-5 [&>li]:items-center'

/** Пустые строки-распорки до `ROW_SLOTS`. Высоту им даёт `ROWS`, содержимого не надо. */
function fillerRows(used: number) {
  return Array.from({ length: Math.max(0, ROW_SLOTS - used) }, (_, i) => (
    <li key={`filler-${i}`} aria-hidden />
  ))
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
 * Высота блока постоянная и не зависит от выбранного кошелька — ни от числа групп
 * и пакетов, ни от того, выбран ли кошелёк вообще. Блок стоит посреди формы, и
 * прыжок при смене уводил бы поля из-под курсора. Отсюда `ROW_SLOTS` и распорки, а
 * заодно и то, что строка долга живёт внутри шапки, а не отдельной секцией: секция
 * принесла бы с собой ещё и разделительную линию, которой в остальных случаях нет.
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
  const groups = wallet?.studentGroups ?? []
  // Умещаемся в отведённые строки: при переполнении показываем на одну меньше,
  // последнюю строку занимает «ещё N». Пакеты приходят с сервера уже обрезанными
  // (`take: 2`), группы — нет.
  const shownGroups = groups.length > ROW_SLOTS ? groups.slice(0, ROW_SLOTS - 1) : groups
  const hiddenGroups = groups.length - shownGroups.length
  const payments = wallet?.payments ?? []
  const hiddenPayments = wallet ? wallet._count.payments - payments.length : 0

  return (
    // Части разделены линиями, а не отступами: в блоке из десяти строк одного
    // расстояния мало, чтобы имя, группы и оплаты читались как разные вещи.
    // Пунктир — знак, что кошелёк ещё не выбран, а размер тот же.
    <div className={`${BOX} divide-border flex flex-col divide-y ${wallet ? '' : 'border-dashed'}`}>
      <div className="flex flex-col gap-0.5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate font-medium ${wallet ? '' : 'text-muted-foreground'}`}>
            {wallet ? wallet.name || 'Без названия' : 'Кошелёк не выбран'}
          </span>
          {/* Главная цифра кошелька: сколько занятий у ученика на руках. Стрелка —
              каким остаток станет с этой оплатой, с поправкой на занятия, которые
              она закроет: сервер спишет их сразу (`settleUnpaidAttendancesTx`),
              и без поправки стрелка обещала бы остаток, которого не будет. */}
          {wallet && (
            <span className="text-muted-foreground shrink-0 tabular-nums">
              Остаток {wallet.lessonsBalance}
              {addedLessons
                ? ` → ${wallet.lessonsBalance + addedLessons - Math.min(unpaidLessons, addedLessons)}`
                : ''}
            </span>
          )}
        </div>
        {/* Долг объясняет, почему остаток вырастет не на всю оплату: эти занятия
            уже проведены, и оплата закроет их первыми. Строка стоит всегда —
            пустая, когда долга нет. */}
        {unpaidLessons > 0 ? (
          <span className="text-warning">{formatWaiting(unpaidLessons)}</span>
        ) : (
          <span aria-hidden className="select-none">
            &nbsp;
          </span>
        )}
      </div>

      {/* Обе секции стоят всегда: пустая «Оплаты» — это сообщение, что кошелёк
          новый, а не повод убрать заголовок и оставить читателя гадать. */}
      <div className="flex flex-col gap-0.5 py-2">
        <span className={HEADING}>Группы</span>
        <ul className={`flex flex-col gap-0.5 ${ROWS}`}>
          {wallet && groups.length === 0 && <li className="text-muted-foreground">Нет групп</li>}
          {shownGroups.map((sg, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">{getGroupName(sg.group)}</span>
              <Badge variant={STUDENT_STATUS[sg.status].variant} className="shrink-0">
                {STUDENT_STATUS[sg.status].label}
              </Badge>
            </li>
          ))}
          {hiddenGroups > 0 && (
            <li className="text-muted-foreground">{formatMoreGroups(hiddenGroups)}</li>
          )}
          {fillerRows(
            wallet
              ? (groups.length === 0 ? 1 : shownGroups.length) + (hiddenGroups > 0 ? 1 : 0)
              : 0,
          )}
        </ul>
      </div>

      <div className="flex flex-col gap-0.5 pt-2">
        <span className={HEADING}>Оплаты</span>
        <ul className={`flex flex-col gap-0.5 ${ROWS}`}>
          {wallet && payments.length === 0 && <li className="text-muted-foreground">Нет оплат</li>}
          {payments.map((p) => (
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
          {fillerRows(
            wallet
              ? (payments.length === 0 ? 1 : payments.length) + (hiddenPayments > 0 ? 1 : 0)
              : 0,
          )}
        </ul>
      </div>
    </div>
  )
}
