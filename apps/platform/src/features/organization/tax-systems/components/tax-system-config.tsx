'use client'

import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Separator } from '@/src/components/ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/src/components/ui/sheet'
import { Skeleton } from '@/src/components/ui/skeleton'
import { cn } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTaxConfigQuery, useTaxConfigUpsertMutation } from '../queries'
import {
  TAX_SYSTEM_CONFIG_SCHEMAS,
  TAX_SYSTEMS,
  UsnIncomeConfigSchema,
  type TaxSystemKey,
  type UsnIncomeConfig,
} from '../schemas'

function getDefaultConfig(system: TaxSystemKey): Record<string, unknown> {
  const schema = TAX_SYSTEM_CONFIG_SCHEMAS[system]
  return schema.parse({})
}

const USN_INCOME_LABELS: Record<keyof UsnIncomeConfig, string> = {
  incomeTaxRate: 'Ставка налога на доход',
  insuranceRate: 'Страховые взносы свыше порога',
  insuranceThreshold: 'Порог страховых взносов',
  fixedContributions: 'Обязательные взносы ИП',
}

function formatConfigValue(key: keyof UsnIncomeConfig, value: number): string {
  if (key === 'incomeTaxRate' || key === 'insuranceRate') return `${value}%`
  return `${value.toLocaleString('ru-RU')} ₽/год`
}

export default function TaxSystemConfig() {
  const { data: taxConfig, isLoading, isError } = useTaxConfigQuery()
  const { mutate, isPending } = useTaxConfigUpsertMutation()
  const [sheetOpen, setSheetOpen] = useState(false)

  const selectedSystem: TaxSystemKey = (taxConfig?.taxSystem as TaxSystemKey) ?? 'USN_INCOME'

  const currentConfig =
    UsnIncomeConfigSchema.safeParse(taxConfig?.config ?? {}).data ??
    (getDefaultConfig('USN_INCOME') as UsnIncomeConfig)

  const form = useForm({
    resolver: zodResolver(UsnIncomeConfigSchema),
    defaultValues: getDefaultConfig('USN_INCOME') as UsnIncomeConfig,
  })

  useEffect(() => {
    if (taxConfig && taxConfig.taxSystem === 'USN_INCOME') {
      const parsed = UsnIncomeConfigSchema.safeParse(taxConfig.config)
      if (parsed.success) {
        form.reset(parsed.data)
      }
    }
  }, [taxConfig, form])

  const onSubmit = (values: UsnIncomeConfig) => {
    mutate(
      {
        taxSystem: selectedSystem,
        config: values as Record<string, unknown>,
      },
      { onSuccess: () => setSheetOpen(false) },
    )
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    )
  }

  if (isError) {
    return <div className="text-destructive text-sm">Ошибка загрузки настроек</div>
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TAX_SYSTEMS.map((system) => {
          const isSelected = selectedSystem === system.value

          return (
            <div
              key={system.value}
              className={cn(
                'relative flex flex-col rounded-lg border transition-colors',
                !system.enabled && 'opacity-50',
                isSelected ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 p-4 pb-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{system.label}</span>
                    {!system.enabled && <Badge variant="secondary">Скоро</Badge>}
                    {isSelected && <Badge variant="default">Активна</Badge>}
                  </div>
                  <span className="text-muted-foreground text-xs">{system.description}</span>
                </div>
                {system.enabled && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setSheetOpen(true)}>
                    <Pencil />
                  </Button>
                )}
              </div>

              {/* Config summary */}
              {system.enabled && system.value === 'USN_INCOME' && (
                <>
                  <Separator />
                  <div className="space-y-1.5 p-4 pt-3">
                    {(Object.entries(USN_INCOME_LABELS) as [keyof UsnIncomeConfig, string][]).map(
                      ([key, label]) => (
                        <div key={key} className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground text-xs">{label}</span>
                          <span className="text-xs font-medium tabular-nums">
                            {formatConfigValue(key, currentConfig[key])}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Settings sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Настройки УСН «Доходы»</SheetTitle>
            <SheetDescription>
              Укажите параметры налогообложения для вашей организации
            </SheetDescription>
          </SheetHeader>

          <div className="overflow-y-auto px-6">
            <form id="tax-config-form" onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
                <Controller
                  control={form.control}
                  name="incomeTaxRate"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Ставка налога на доход (%)</FieldLabel>
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="insuranceRate"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Страховые взносы свыше порога (%)</FieldLabel>
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="insuranceThreshold"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Порог для страховых взносов (₽/год)</FieldLabel>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="fixedContributions"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Обязательные взносы ИП (₽/год)</FieldLabel>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </FieldGroup>
            </form>
          </div>

          <SheetFooter>
            <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
            <Button type="submit" form="tax-config-form" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Сохранить
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
