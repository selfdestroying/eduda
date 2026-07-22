'use client'

import * as React from 'react'

import { Input } from '@/src/components/ui/input'
import { cn } from '@/src/lib/utils'

interface NumberInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'onChange' | 'value'
> {
  value?: number | ''
  onChange?: (value: number | '') => void
  min?: number
  max?: number
  step?: number
  allowDecimal?: boolean
}

function NumberInput({
  value: controlledValue,
  onChange,
  min,
  max,
  step = 1,
  allowDecimal = false,
  className,
  onKeyDown,
  ...props
}: NumberInputProps) {
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = React.useState('')
  // Raw string tracks what user actually typed (e.g. "-", "3.", "-0")
  const [rawInput, setRawInput] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const numericValue = isControlled
    ? controlledValue
    : internalValue === ''
      ? ''
      : Number(internalValue)

  // Sync rawInput when controlled value changes externally
  const [prevControlledValue, setPrevControlledValue] = React.useState(controlledValue)
  if (isControlled && prevControlledValue !== controlledValue) {
    setPrevControlledValue(controlledValue)
    setRawInput(
      controlledValue === '' || controlledValue === undefined ? '' : String(controlledValue),
    )
  }

  const clamp = (n: number) => {
    if (min !== undefined && n < min) return min
    if (max !== undefined && n > max) return max
    return n
  }

  const isIntermediateInput = (s: string) =>
    s === '-' || s === '.' || s === '-.' || s === '-0' || (allowDecimal && s.endsWith('.'))

  const setValue = (num: number | '') => {
    if (!isControlled) setInternalValue(num === '' ? '' : String(num))
    onChange?.(num)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value

    if (raw === '') {
      setRawInput('')
      setValue('')
      return
    }

    const pattern = allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/
    if (!pattern.test(raw)) return

    setRawInput(raw)

    if (isIntermediateInput(raw)) return

    const parsed = allowDecimal ? parseFloat(raw) : parseInt(raw, 10)
    if (isNaN(parsed)) return

    setValue(clamp(parsed))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const current = typeof numericValue === 'number' ? numericValue : 0
      const next = e.key === 'ArrowUp' ? current + step : current - step
      const clamped = clamp(allowDecimal ? parseFloat(next.toFixed(10)) : next)
      setRawInput(String(clamped))
      setValue(clamped)
    }
    onKeyDown?.(e)
  }

  // Show raw input for intermediate states, otherwise show the numeric value
  const displayValue = isIntermediateInput(rawInput)
    ? rawInput
    : numericValue === '' || numericValue === undefined
      ? ''
      : String(numericValue)

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={displayValue}
      onChange={handleChange as unknown as React.ChangeEventHandler<HTMLInputElement>}
      onKeyDown={handleKeyDown}
      className={cn(
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        className,
      )}
      {...props}
    />
  )
}

export { NumberInput }
export type { NumberInputProps }
