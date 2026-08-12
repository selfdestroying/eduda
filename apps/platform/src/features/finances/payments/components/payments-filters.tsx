'use client'

import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Field, FieldLabel } from '@repo/ui/components/field'
import { Input } from '@repo/ui/components/input'
import { NumberInput } from '@repo/ui/components/number-input'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'
import TableFilter, { type TableFilterItem } from '@repo/ui/components/table-filter'
import DateRangeFilter from '@/src/components/date-range-filter'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import { formatCurrency } from '@/src/lib/utils'
import type { ColumnFiltersState } from '@tanstack/react-table'
import { ListFilter, Search, X } from 'lucide-react'
import { useMemo } from 'react'
import type { DateRange } from 'react-day-picker'
import { useActivePaymentMethodListQuery } from '../../payment-methods/queries'
import { type PaymentKind, PAYMENT_KIND_OPTIONS } from '../constants'

interface PaymentsFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  period: DateRange | undefined
  onPeriodChange: (range: DateRange | undefined) => void
  columnFilters: ColumnFiltersState
  setColumnFilters: (
    updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState),
  ) => void
  kind: PaymentKind[]
  onKindChange: (values: PaymentKind[]) => void
  amountMin: number | null
  amountMax: number | null
  onAmountMinChange: (value: number | null) => void
  onAmountMaxChange: (value: number | null) => void
  onReset: () => void
}

/**
 * Значения одного мультиселекта из состояния фильтров таблицы.
 *
 * Отдельно считаем «сколько выбрано» по сырым ключам из URL, а не по тому, что
 * удалось сопоставить с опциями: метод могли деактивировать, менеджер мог уйти
 * из школы. Фильтровать таблица по такому ключу продолжает, поэтому и чипса, и
 * счётчик обязаны его показывать — иначе строки пропадают без объяснения.
 */
function useSelected(
  columnFilters: ColumnFiltersState,
  id: string,
  items: TableFilterItem[],
): { selected: TableFilterItem[]; count: number } {
  return useMemo(() => {
    const filter = columnFilters.find((f) => f.id === id)
    if (!filter) return { selected: [], count: 0 }
    // Ключи фильтров приезжают из URL: у метода и менеджера это числа.
    const values = (filter.value as Array<string | number>).map(String)
    return {
      selected: items.filter((item) => values.includes(item.value)),
      count: values.length,
    }
  }, [columnFilters, id, items])
}

/** Подпись чипсы: имена, если известны, иначе честное «N выбрано». */
function chipLabel(prefix: string, selected: TableFilterItem[], count: number) {
  if (selected.length === 0) return `${prefix}: ${count} выбрано`
  const names = selected.map((s) => s.label).join(', ')
  const unknown = count - selected.length
  return unknown > 0 ? `${prefix}: ${names} и ещё ${unknown}` : `${prefix}: ${names}`
}

/**
 * Снятая с фильтра «чипса». Кнопка целиком, а не бейдж с крестиком внутри:
 * бейдж высотой 20px обрезает вложенную кнопку, а кликать нужно по всему.
 */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Button variant="outline" className="max-w-56 gap-1 font-normal" onClick={onRemove}>
      <span className="truncate">{label}</span>
      <X className="opacity-60" />
    </Button>
  )
}

export default function PaymentsFilters({
  search,
  onSearchChange,
  period,
  onPeriodChange,
  columnFilters,
  setColumnFilters,
  kind,
  onKindChange,
  amountMin,
  amountMax,
  onAmountMinChange,
  onAmountMaxChange,
  onReset,
}: PaymentsFiltersProps) {
  const { data: paymentMethods = [] } = useActivePaymentMethodListQuery()
  const { data: members = [] } = useMappedMemberListQuery()

  const methodItems = useMemo<TableFilterItem[]>(
    () => paymentMethods.map((m) => ({ value: String(m.id), label: m.name })),
    [paymentMethods],
  )

  const methods = useSelected(columnFilters, 'paymentMethod', methodItems)
  const managers = useSelected(columnFilters, 'manager', members)
  // Виды — литералы из кода, а не строки БД: неизвестных значений здесь не бывает.
  const selectedKinds = useMemo(
    () => PAYMENT_KIND_OPTIONS.filter((o) => kind.includes(o.value as PaymentKind)),
    [kind],
  )

  const setColumnFilter = (id: string, values: TableFilterItem[]) => {
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== id)
      if (values.length === 0) return rest
      return [...rest, { id, value: values.map((v) => Number(v.value)) }]
    })
  }

  const hasAmount = amountMin !== null || amountMax !== null
  const amountLabel =
    amountMin !== null && amountMax !== null
      ? `${formatCurrency(amountMin)} — ${formatCurrency(amountMax)}`
      : amountMin !== null
        ? `от ${formatCurrency(amountMin)}`
        : amountMax !== null
          ? `до ${formatCurrency(amountMax)}`
          : ''

  // Считаем измерения, а не значения: кнопка отвечает за то, что спрятано
  // внутри неё, — период и поиск видно и так.
  const hiddenFilterCount =
    (methods.count > 0 ? 1 : 0) +
    (managers.count > 0 ? 1 : 0) +
    (selectedKinds.length > 0 ? 1 : 0) +
    (hasAmount ? 1 : 0)

  const showChips = hiddenFilterCount > 0 || Boolean(period) || Boolean(search)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Ученик, менеджер, метод..."
            className="pl-8"
            aria-label="Поиск по оплатам"
          />
        </div>

        {/* Без выбранного периода сервер отдаёт текущий месяц — так и подписываем,
            чтобы «Выберите период» не выглядело как «показано всё». */}
        <DateRangeFilter value={period} onChange={onPeriodChange} placeholder="Текущий месяц" />

        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>
            <ListFilter />
            Фильтры
            {hiddenFilterCount > 0 && <Badge variant="secondary">{hiddenFilterCount}</Badge>}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <div className="flex flex-col gap-3">
              <TableFilter
                label="Метод оплаты"
                items={methodItems}
                value={methods.selected}
                onChange={(values) => setColumnFilter('paymentMethod', values)}
              />
              <TableFilter
                label="Менеджер"
                items={members}
                value={managers.selected}
                onChange={(values) => setColumnFilter('manager', values)}
              />
              <TableFilter
                label="Вид"
                items={PAYMENT_KIND_OPTIONS}
                value={selectedKinds}
                onChange={(values) => onKindChange(values.map((v) => v.value as PaymentKind))}
              />
              <div className="flex items-end gap-2">
                <Field>
                  <FieldLabel htmlFor="payments-amount-min">Сумма от</FieldLabel>
                  <NumberInput
                    id="payments-amount-min"
                    placeholder="0"
                    value={amountMin ?? ''}
                    onChange={(v) => onAmountMinChange(v === '' ? null : v)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="payments-amount-max">до</FieldLabel>
                  <NumberInput
                    id="payments-amount-max"
                    placeholder="∞"
                    value={amountMax ?? ''}
                    onChange={(v) => onAmountMaxChange(v === '' ? null : v)}
                  />
                </Field>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Чипсы показывают то, что иначе не видно: содержимое поповера. Период и
          поиск свои значения показывают сами и в чипсах не дублируются. */}
      {showChips && (
        <div className="flex flex-wrap items-center gap-2">
          {methods.count > 0 && (
            <FilterChip
              label={chipLabel('Метод', methods.selected, methods.count)}
              onRemove={() => setColumnFilter('paymentMethod', [])}
            />
          )}
          {managers.count > 0 && (
            <FilterChip
              label={chipLabel('Менеджер', managers.selected, managers.count)}
              onRemove={() => setColumnFilter('manager', [])}
            />
          )}
          {selectedKinds.length > 0 && (
            <FilterChip
              label={`Вид: ${selectedKinds.map((k) => k.label).join(', ')}`}
              onRemove={() => onKindChange([])}
            />
          )}
          {hasAmount && (
            <FilterChip
              label={`Сумма: ${amountLabel}`}
              onRemove={() => {
                onAmountMinChange(null)
                onAmountMaxChange(null)
              }}
            />
          )}
          <Button variant="ghost" className="text-muted-foreground" onClick={onReset}>
            Сбросить всё
          </Button>
        </div>
      )}
    </div>
  )
}
