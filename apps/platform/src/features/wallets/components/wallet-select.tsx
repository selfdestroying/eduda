'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { getWalletLabel, type WalletLabelInput } from '@/src/features/wallets/utils'

/**
 * Выбор кошелька ученика.
 *
 * Селект, а не комбобокс с поиском: кошельков у ученика единицы — сезон, курс,
 * депозит, — и строка поиска над списком из трёх пунктов только мешает.
 *
 * Значение — строка: `Select` работает со строками, а id кошелька числовой, и
 * приведение живёт здесь, а не в каждой форме.
 */
export function WalletSelect({
  wallets,
  value,
  onValueChange,
  placeholder = 'Выберите кошелёк',
}: {
  wallets: WalletLabelInput[]
  value: string
  onValueChange: (next: string) => void
  placeholder?: string
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(String(next ?? ''))}>
      <SelectTrigger className="w-full" data-size="default">
        {/* Без функции `SelectValue` показал бы само значение — на кнопке оказался
            бы id кошелька вместо его названия. */}
        <SelectValue placeholder={placeholder}>
          {(selected) => {
            const w = wallets.find((x) => x.id.toString() === selected)
            return w ? getWalletLabel(w) : placeholder
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {wallets.map((w) => (
            <SelectItem key={w.id} value={w.id.toString()}>
              {getWalletLabel(w)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
