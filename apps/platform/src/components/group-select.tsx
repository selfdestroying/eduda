'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'

/**
 * Переключатель свёртки в тулбаре таблицы. Режимы берутся из карты подписей, а не
 * из пропса-массива — как у `ChartTabs`: ключи это и есть значения, и разъехаться
 * им негде.
 *
 * Само значение хранит вызывающий, обычно в адресной строке: ссылкой на
 * «отчисленных по преподавателям» делятся так же, как на отфильтрованный список.
 */
export default function GroupSelect<T extends string>({
  value,
  onValueChange,
  labels,
}: {
  value: T
  onValueChange: (next: T) => void
  labels: Record<T, string>
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(String(next) as T)}>
      {/* На телефоне забирает остаток строки рядом с «Фильтрами», на широком —
          фиксированные 9rem. */}
      <SelectTrigger className="min-w-0 flex-1 sm:w-36 sm:flex-none">
        {/* Без функции `SelectValue` показывает само значение — на кнопке
            оказывалось бы «none» вместо «Без группировки». */}
        <SelectValue>{(selected) => labels[selected as T]}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {(Object.keys(labels) as T[]).map((key) => (
            <SelectItem key={key} value={key}>
              {labels[key]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
