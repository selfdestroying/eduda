'use client'

import { FieldDescription, FieldLegend, FieldSet } from '@/src/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/src/components/ui/radio-group'
import {
  PERMISSION_MODULE_KEYS,
  PERMISSION_MODULES,
  type ModuleLevel,
  type ModuleSelection,
} from '@/src/lib/permissions/modules'
import { cn } from '@/src/lib/utils'

const LEVELS: { value: ModuleLevel; label: string }[] = [
  { value: 'none', label: 'Нет' },
  { value: 'view', label: 'Просмотр' },
  { value: 'manage', label: 'Управление' },
]

export default function RoleAccess({
  selection,
  onChange,
  disabled = false,
}: {
  selection: ModuleSelection
  onChange: (key: string, level: ModuleLevel) => void
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
        disabled && 'opacity-60 select-none',
      )}
    >
      {PERMISSION_MODULE_KEYS.map((key) => {
        const level = (selection[key] ?? 'none') as ModuleLevel
        return (
          <FieldSet key={key} className="rounded-lg border p-3">
            <FieldLegend>{PERMISSION_MODULES[key].label}</FieldLegend>
            <FieldDescription>{PERMISSION_MODULES[key].description}</FieldDescription>
            <RadioGroup
              value={level}
              onValueChange={(v) => onChange(key, v as ModuleLevel)}
              disabled={disabled}
              className="gap-1.5"
            >
              {LEVELS.map((l) => (
                <label
                  key={l.value}
                  className="text-muted-foreground has-data-checked:text-foreground flex cursor-pointer items-center gap-2 text-xs"
                >
                  <RadioGroupItem value={l.value} />
                  {l.label}
                </label>
              ))}
            </RadioGroup>
          </FieldSet>
        )
      })}
    </div>
  )
}
