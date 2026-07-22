import * as z from 'zod'

// ─── Per-system config schemas ───────────────────────────────────────────────

export const UsnIncomeConfigSchema = z.object({
  incomeTaxRate: z
    .number('Укажите ставку налога')
    .min(0, 'Ставка не может быть отрицательной')
    .max(100, 'Ставка не может превышать 100%')
    .default(6),
  insuranceRate: z
    .number('Укажите ставку страховых взносов')
    .min(0, 'Ставка не может быть отрицательной')
    .max(100, 'Ставка не может превышать 100%')
    .default(1),
  insuranceThreshold: z
    .number('Укажите порог страховых взносов')
    .int('Сумма должна быть целым числом')
    .min(0, 'Сумма не может быть отрицательной')
    .default(300000),
  fixedContributions: z
    .number('Укажите сумму обязательных взносов')
    .int('Сумма должна быть целым числом')
    .min(0, 'Сумма не может быть отрицательной')
    .default(49500),
})

export const OsnoConfigSchema = z.object({
  profitTaxRate: z
    .number('Укажите ставку налога на прибыль')
    .min(0, 'Ставка не может быть отрицательной')
    .max(100, 'Ставка не может превышать 100%')
    .default(20),
  vatRate: z
    .number('Укажите ставку НДС')
    .min(0, 'Ставка не может быть отрицательной')
    .max(100, 'Ставка не может превышать 100%')
    .default(20),
  propertyTaxRate: z
    .number('Укажите ставку налога на имущество')
    .min(0, 'Ставка не может быть отрицательной')
    .max(100, 'Ставка не может превышать 100%')
    .default(2.2),
  insuranceContributions: z
    .number('Укажите сумму страховых взносов')
    .int('Сумма должна быть целым числом')
    .min(0, 'Сумма не может быть отрицательной')
    .default(0),
})

export const UsnIncomeExpensesConfigSchema = z.object({
  taxRate: z
    .number('Укажите ставку налога')
    .min(0, 'Ставка не может быть отрицательной')
    .max(100, 'Ставка не может превышать 100%')
    .default(15),
  minTaxRate: z
    .number('Укажите минимальную ставку налога')
    .min(0, 'Ставка не может быть отрицательной')
    .max(100, 'Ставка не может превышать 100%')
    .default(1),
  insuranceRate: z
    .number('Укажите ставку страховых взносов')
    .min(0, 'Ставка не может быть отрицательной')
    .max(100, 'Ставка не может превышать 100%')
    .default(1),
  insuranceThreshold: z
    .number('Укажите порог страховых взносов')
    .int('Сумма должна быть целым числом')
    .min(0, 'Сумма не может быть отрицательной')
    .default(300000),
  fixedContributions: z
    .number('Укажите сумму обязательных взносов')
    .int('Сумма должна быть целым числом')
    .min(0, 'Сумма не может быть отрицательной')
    .default(49500),
})

// ─── Tax system registry ─────────────────────────────────────────────────────

export const TAX_SYSTEM_CONFIG_SCHEMAS = {
  USN_INCOME: UsnIncomeConfigSchema,
  OSNO: OsnoConfigSchema,
  USN_INCOME_EXPENSES: UsnIncomeExpensesConfigSchema,
} as const

export type TaxSystemKey = keyof typeof TAX_SYSTEM_CONFIG_SCHEMAS

export const TAX_SYSTEMS: {
  value: TaxSystemKey
  label: string
  description: string
  enabled: boolean
}[] = [
  {
    value: 'USN_INCOME',
    label: 'УСН «Доходы»',
    description: 'Упрощённая система налогообложения - 6% от дохода',
    enabled: true,
  },
  {
    value: 'USN_INCOME_EXPENSES',
    label: 'УСН «Доходы минус расходы»',
    description: 'Упрощённая система - 15% от разницы между доходами и расходами',
    enabled: false,
  },
  {
    value: 'OSNO',
    label: 'ОСНО',
    description: 'Общая система налогообложения - НДС, налог на прибыль, налог на имущество',
    enabled: false,
  },
]

// ─── Upsert schema (used by server action) ───────────────────────────────────

export const UpsertTaxConfigSchema = z
  .object({
    taxSystem: z.string().min(1, 'Выберите систему налогообложения'),
    config: z.record(z.string(), z.unknown()),
  })
  .superRefine((val, ctx) => {
    const systemSchema = TAX_SYSTEM_CONFIG_SCHEMAS[val.taxSystem as TaxSystemKey]
    if (!systemSchema) {
      ctx.addIssue({
        code: 'custom',
        message: 'Неизвестная система налогообложения',
        path: ['taxSystem'],
      })
      return
    }
    const result = systemSchema.safeParse(val.config)
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          ...issue,
          path: ['config', ...issue.path],
        })
      }
    }
  })

export type UpsertTaxConfigSchemaType = z.infer<typeof UpsertTaxConfigSchema>
export type UsnIncomeConfig = z.infer<typeof UsnIncomeConfigSchema>
export type OsnoConfig = z.infer<typeof OsnoConfigSchema>
export type UsnIncomeExpensesConfig = z.infer<typeof UsnIncomeExpensesConfigSchema>

export const DEFAULT_TAX_SYSTEM: TaxSystemKey = 'USN_INCOME'
