'use client'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/src/components/ui/combobox'
import { ReactNode } from 'react'

// ─── Default item shape ─────────────────────────────────────────────
interface DefaultItem {
  label: string
  value: string | number
}

// ─── Props ──────────────────────────────────────────────────────────
interface CustomComboboxProps<T> {
  /** Array of items to display in the dropdown. */
  items: T[]
  /** Currently selected item (controlled). */
  value: T | null
  /** Callback when selected item changes. */
  onValueChange: (value: T | null) => void

  // ── Item accessors ──────────────────────────────────────────────
  /** Extract display label from an item. Defaults to `item.label`. */
  getLabel?: (item: T) => string
  /** Extract unique key from an item. Defaults to `item.value`. */
  getKey?: (item: T) => string | number
  /** Custom equality check. Defaults to comparing by `getKey`. */
  isItemEqualToValue?: (a: T, b: T) => boolean

  // ── Custom rendering ────────────────────────────────────────────
  /** Custom render for each dropdown item. Receives the item object. */
  renderItem?: (item: T) => ReactNode

  // ── Configuration ───────────────────────────────────────────────
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  itemDisabled?: (item: T) => boolean
  className?: string
  id?: string
  showClear?: boolean
  showTrigger?: boolean
  ariaInvalid?: boolean
}

function defaultGetLabel<T>(item: T): string {
  return (item as DefaultItem).label ?? String(item)
}

function defaultGetKey<T>(item: T): string | number {
  return (item as DefaultItem).value ?? String(item)
}

function CustomCombobox<T>({
  items,
  value,
  onValueChange,
  getLabel = defaultGetLabel,
  getKey = defaultGetKey,
  isItemEqualToValue,
  renderItem,
  placeholder,
  emptyText = 'Ничего не найдено',
  disabled = false,
  className,
  id,
  showClear = false,
  showTrigger = true,
  itemDisabled,
  ariaInvalid,
}: CustomComboboxProps<T>) {
  const equalityFn = isItemEqualToValue ?? ((a: T, b: T) => getKey(a) === getKey(b))

  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={onValueChange}
      isItemEqualToValue={equalityFn}
      itemToStringLabel={getLabel}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        disabled={disabled}
        showClear={showClear}
        showTrigger={showTrigger}
        className={className}
        aria-invalid={ariaInvalid}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item: T) => (
            <ComboboxItem key={String(getKey(item))} value={item} disabled={itemDisabled?.(item)}>
              {renderItem ? renderItem(item) : getLabel(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export { CustomCombobox }
export type { CustomComboboxProps }
