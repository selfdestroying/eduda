'use client'

import { Button } from '@repo/ui/components/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { useStudentWalletsQuery } from '@/src/features/wallets/queries'
import { X } from 'lucide-react'
import { useEffect, useMemo } from 'react'

const NEW_WALLET = 'new'

export interface EnrolledStudent {
  studentId: number
  walletId?: number
  newWalletName?: string
}

interface EnrolledStudentRowProps {
  name: string
  entry: EnrolledStudent
  onWalletChange: (patch: Pick<EnrolledStudent, 'walletId' | 'newWalletName'>) => void
  onRemove: () => void
  disabled?: boolean
  invalid?: boolean
}

export function EnrolledStudentRow({
  name,
  entry,
  onWalletChange,
  onRemove,
  disabled,
  invalid,
}: EnrolledStudentRowProps) {
  const { data: wallets, isLoading } = useStudentWalletsQuery(entry.studentId, { enabled: true })
  // Архивные отсеивает сам запрос. Мемо — чтобы `?? []` не отдавал новый массив
  // на каждый рендер: на нём держится мемоизация `walletItems` ниже.
  const activeWallets = useMemo(() => wallets ?? [], [wallets])
  const walletsLoaded = wallets !== undefined

  // Кошелёк обязателен: один активный — выбираем его, нет ни одного — создаём новый
  const hasChoice = entry.walletId !== undefined || entry.newWalletName !== undefined
  useEffect(() => {
    if (hasChoice) return
    if (activeWallets.length === 1) onWalletChange({ walletId: activeWallets[0]!.id })
    else if (walletsLoaded && activeWallets.length === 0) onWalletChange({ newWalletName: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChoice, activeWallets.length, walletsLoaded])

  const value =
    entry.walletId !== undefined
      ? String(entry.walletId)
      : entry.newWalletName !== undefined
        ? NEW_WALLET
        : null

  const handleChange = (v: string | null) => {
    if (!v) return
    if (v === NEW_WALLET) onWalletChange({ newWalletName: '' })
    else onWalletChange({ walletId: Number(v) })
  }

  // Мемоизация не ради скорости: `Select.Root` кладёт `items` в свой стор эффектом,
  // зависящим от ссылки на массив. Массив, собранный инлайном в JSX, новый на каждый
  // рендер — стор обновляется, подписчики перерисовываются, массив снова новый, и
  // React в конце концов падает с «Maximum update depth exceeded».
  const walletItems = useMemo(
    () => [
      ...activeWallets.map((w) => ({ value: String(w.id), label: w.name || 'Без названия' })),
      { value: NEW_WALLET, label: 'Новый кошелёк' },
    ],
    [activeWallets],
  )

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-2">
      <span className="min-w-0 truncate text-xs">{name}</span>
      <Select items={walletItems} value={value} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger className="w-full" aria-invalid={invalid}>
          <SelectValue placeholder={isLoading ? 'Загрузка…' : 'Выберите кошелёк'} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {activeWallets.map((w) => (
              <SelectItem key={w.id} value={String(w.id)}>
                {w.name || 'Без названия'}
              </SelectItem>
            ))}
            <SelectItem value={NEW_WALLET}>Новый кошелёк</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        title="Убрать ученика"
      >
        <X />
      </Button>
    </div>
  )
}
