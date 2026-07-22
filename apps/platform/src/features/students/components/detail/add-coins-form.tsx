'use client'

import { NumberInput } from '@/src/components/number-input'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent } from '@/src/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/src/components/ui/toggle-group'
import { cn } from '@/src/lib/utils'
import { Check, Coins, Loader, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useStudentCoinsMutation } from '../../queries'

interface AddCoinsFormProps {
  studentId: number
  currentCoins: number
}

type Sign = 'add' | 'subtract'

const PRESETS = [10, 50, 100] as const

export default function AddCoinsForm({ studentId, currentCoins }: AddCoinsFormProps) {
  const [sign, setSign] = useState<Sign>('add')
  const [amount, setAmount] = useState<number | undefined>()
  const mutation = useStudentCoinsMutation(studentId)

  const isSubtract = sign === 'subtract'
  const signedAmount = amount ? (isSubtract ? -amount : amount) : 0
  const projected = currentCoins + signedAmount
  const canSubmit = !!amount && amount > 0 && projected >= 0 && !mutation.isPending

  const handleSubmit = () => {
    if (!canSubmit) return
    mutation.mutate(
      { studentId, coins: signedAmount },
      {
        onSuccess: () => setAmount(undefined),
      },
    )
  }

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Корректировка баланса</span>
          {amount ? (
            <span
              className={cn(
                'flex items-center gap-1 text-xs font-semibold tabular-nums',
                isSubtract
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {isSubtract ? '−' : '+'}
              {amount}
              <Coins className="size-3" />
              <span className="text-muted-foreground ml-1 font-normal">→ {projected}</span>
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            variant={'outline'}
            spacing={2}
            multiple={false}
            value={[sign]}
            onValueChange={(v) => v[0] && setSign(v[0] as Sign)}
            className={'w-full'}
          >
            <ToggleGroupItem
              value="subtract"
              className={
                'data-pressed:bg-destructive/20 data-pressed:text-destructive data-pressed:border-destructive/70'
              }
              pressed={sign == 'subtract'}
            >
              <Minus />
            </ToggleGroupItem>
            <NumberInput
              min={1}
              max={isSubtract ? currentCoins : undefined}
              placeholder="Кол-во"
              value={amount ?? ''}
              onChange={(v) => setAmount(v === '' ? undefined : v)}
              disabled={mutation.isPending}
            />
            <ToggleGroupItem
              value="add"
              className={
                'data-pressed:bg-success/20 data-pressed:text-success data-pressed:border-success/70'
              }
              pressed={sign == 'add'}
            >
              <Plus />
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                disabled={mutation.isPending || (isSubtract && currentCoins < preset)}
                onClick={() => setAmount((prev) => (prev ?? 0) + preset)}
              >
                +{preset}
              </Button>
            ))}
          </div>

          <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className={'ml-auto'}>
            {mutation.isPending ? <Loader className="animate-spin" /> : <Check />}
            Применить
          </Button>
        </div>

        {amount && projected < 0 ? (
          <p className="text-destructive text-xs">Недостаточно монет: на балансе {currentCoins}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
