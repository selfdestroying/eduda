'use client'

import { Button } from '@repo/ui/components/button'
import { Field, FieldLabel } from '@repo/ui/components/field'
import { Input } from '@repo/ui/components/input'
import { NumberInput } from '@repo/ui/components/number-input'
import TableFilter, { type TableFilterItem } from '@repo/ui/components/table-filter'
import DateRangeFilter from '@/src/components/date-range-filter'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import type { ColumnFiltersState } from '@tanstack/react-table'
import { FilterX } from 'lucide-react'
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
  hasActiveFilters: boolean
  onReset: () => void
}

/** Значения одного мультиселекта из состояния фильтров таблицы. */
function useSelected(
  columnFilters: ColumnFiltersState,
  id: string,
  items: TableFilterItem[],
): TableFilterItem[] {
  return useMemo(() => {
    const filter = columnFilters.find((f) => f.id === id)
    if (!filter) return []
    // Ключи фильтров приезжают из URL: у метода и менеджера это числа, у вида — строки.
    const values = (filter.value as Array<string | number>).map(String)
    return items.filter((item) => values.includes(item.value))
  }, [columnFilters, id, items])
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
  hasActiveFilters,
  onReset,
}: PaymentsFiltersProps) {
  const { data: paymentMethods = [] } = useActivePaymentMethodListQuery()
  const { data: members = [] } = useMappedMemberListQuery()

  const methodItems = useMemo<TableFilterItem[]>(
    () => paymentMethods.map((m) => ({ value: String(m.id), label: m.name })),
    [paymentMethods],
  )

  const selectedMethods = useSelected(columnFilters, 'paymentMethod', methodItems)
  const selectedManagers = useSelected(columnFilters, 'manager', members)
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

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field className="w-full sm:w-56">
        <FieldLabel htmlFor="payments-search">Поиск</FieldLabel>
        <Input
          id="payments-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Ученик, менеджер, метод..."
        />
      </Field>

      <Field className="w-fit">
        <FieldLabel>Период</FieldLabel>
        <DateRangeFilter value={period} onChange={onPeriodChange} />
      </Field>

      <div className="w-full sm:w-44">
        <TableFilter
          label="Метод"
          items={methodItems}
          value={selectedMethods}
          onChange={(values) => setColumnFilter('paymentMethod', values)}
        />
      </div>

      <div className="w-full sm:w-44">
        <TableFilter
          label="Менеджер"
          items={members}
          value={selectedManagers}
          onChange={(values) => setColumnFilter('manager', values)}
        />
      </div>

      <div className="w-full sm:w-44">
        <TableFilter
          label="Вид"
          items={PAYMENT_KIND_OPTIONS}
          value={selectedKinds}
          onChange={(values) => onKindChange(values.map((v) => v.value as PaymentKind))}
        />
      </div>

      <Field className="w-28">
        <FieldLabel htmlFor="payments-amount-min">Сумма от</FieldLabel>
        <NumberInput
          id="payments-amount-min"
          placeholder="0"
          value={amountMin ?? ''}
          onChange={(v) => onAmountMinChange(v === '' ? null : v)}
        />
      </Field>

      <Field className="w-28">
        <FieldLabel htmlFor="payments-amount-max">до</FieldLabel>
        <NumberInput
          id="payments-amount-max"
          placeholder="∞"
          value={amountMax ?? ''}
          onChange={(v) => onAmountMaxChange(v === '' ? null : v)}
        />
      </Field>

      {hasActiveFilters && (
        <Button variant="ghost" onClick={onReset}>
          <FilterX />
          Сбросить
        </Button>
      )}
    </div>
  )
}
