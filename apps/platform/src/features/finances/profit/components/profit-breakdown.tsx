'use client'

import { Hint } from '@/src/components/hint'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/src/components/ui/accordion'
import { Badge } from '@/src/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Building2, CreditCard, Landmark, Receipt, Users } from 'lucide-react'
import type { ProfitData } from '../types'
import { formatCurrency } from '@/src/lib/utils'

function pct(part: number, total: number) {
  if (total === 0) return '0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

interface ProfitBreakdownProps {
  data: ProfitData
}

export default function ProfitBreakdown({ data }: ProfitBreakdownProps) {
  const { revenue, taxes, acquiring, salaries, rent, expenses } = data
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          Детализация расходов
          <Hint text="Подробная разбивка всех расходов за выбранный период" />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-2 sm:px-4">
        {/* Waterfall bar */}
        <div className="mb-4 px-4 sm:px-0">
          <WaterfallBar data={data} />
        </div>

        <Accordion>
          {/* Taxes */}
          <AccordionItem>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Landmark className="text-muted-foreground size-4" />
                <span>Налоги</span>
                <Badge variant="outline" className="text-[0.625rem]">
                  {taxes.breakdown.taxSystemLabel}
                </Badge>
              </div>
              <span className="text-muted-foreground mr-6 font-mono text-xs">
                {formatCurrency(taxes.total)}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <DetailRow
                  label={`Налог на доход (${taxes.breakdown.incomeTaxRate}%)`}
                  value={formatCurrency(taxes.breakdown.incomeTax)}
                  hint={`${pct(taxes.breakdown.incomeTax, revenue)} от выручки`}
                />
                <DetailRow
                  label="Страховые взносы (сверх порога)"
                  value={formatCurrency(taxes.breakdown.insuranceContributions)}
                  hint="1% от дохода, превышающего порог"
                />
                <DetailRow
                  label="Фиксированные взносы"
                  value={formatCurrency(taxes.breakdown.fixedContributions)}
                  hint="Обязательные страховые взносы за период"
                />
                <div className="border-t pt-2">
                  <DetailRow label="Итого налоги" value={formatCurrency(taxes.total)} bold />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Acquiring */}
          <AccordionItem>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <CreditCard className="text-muted-foreground size-4" />
                <span>Эквайринг</span>
                <Badge variant="outline" className="text-[0.625rem]">
                  {acquiring.breakdown.length} мет.
                </Badge>
              </div>
              <span className="text-muted-foreground mr-6 font-mono text-xs">
                {formatCurrency(acquiring.total)}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {acquiring.breakdown.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Нет оплат с комиссией за выбранный период
                  </p>
                ) : (
                  <>
                    {acquiring.breakdown.map((item) => (
                      <DetailRow
                        key={item.methodName}
                        label={`${item.methodName} (${item.commissionPercent}%)`}
                        value={formatCurrency(item.fee)}
                        hint={`Оплат на ${formatCurrency(item.paymentSum)} × ${item.commissionPercent}%`}
                      />
                    ))}
                    <div className="border-t pt-2">
                      <DetailRow
                        label="Итого эквайринг"
                        value={formatCurrency(acquiring.total)}
                        bold
                      />
                    </div>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Salaries */}
          <AccordionItem>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Users className="text-muted-foreground size-4" />
                <span>Зарплаты</span>
                <Badge variant="outline" className="text-[0.625rem]">
                  {salaries.teacherCount} преп. · {salaries.managerCount} мен.
                </Badge>
              </div>
              <span className="text-muted-foreground mr-6 font-mono text-xs">
                {formatCurrency(salaries.total)}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <DetailRow
                  label="Оплата за уроки"
                  value={formatCurrency(salaries.totalFromLessons)}
                  hint={`${salaries.lessonCount} уроков. Формула: ставка + бонус за ученика × кол-во присутствующих`}
                />
                <DetailRow
                  label="Начисления преподавателям"
                  value={formatCurrency(salaries.totalFromPaychecks)}
                  hint="Авансы и бонусы, зафиксированные в системе"
                />
                <DetailRow
                  label="Фикс. зарплаты менеджеров"
                  value={formatCurrency(salaries.totalFromManagerFixed)}
                  hint="Начислено по ставкам менеджеров за месяцы, попадающие в период. Полный месяц засчитывается, если часть месяца попадает в период"
                />
                <DetailRow
                  label="Начисления менеджерам"
                  value={formatCurrency(salaries.totalFromManagerPaychecks)}
                  hint="Бонусы и авансы менеджеров за период"
                />
                <div className="border-t pt-2">
                  <DetailRow label="Итого зарплаты" value={formatCurrency(salaries.total)} bold />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Rent */}
          <AccordionItem>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Building2 className="text-muted-foreground size-4" />
                <span>Аренда</span>
                <Badge variant="outline" className="text-[0.625rem]">
                  {rent.breakdown.length} лок.
                </Badge>
              </div>
              <span className="text-muted-foreground mr-6 font-mono text-xs">
                {formatCurrency(rent.total)}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {rent.breakdown.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Нет расходов на аренду за выбранный период
                  </p>
                ) : (
                  <>
                    {rent.breakdown.map((item) => (
                      <DetailRow
                        key={item.locationName}
                        label={item.locationName}
                        value={formatCurrency(item.amount)}
                        hint={`${pct(item.amount, rent.total)} от общей аренды`}
                      />
                    ))}
                    <div className="border-t pt-2">
                      <DetailRow label="Итого аренда" value={formatCurrency(rent.total)} bold />
                    </div>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Other expenses */}
          <AccordionItem>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Receipt className="text-muted-foreground size-4" />
                <span>Прочие расходы</span>
                <Badge variant="outline" className="text-[0.625rem]">
                  {expenses.breakdown.length} позиц.
                </Badge>
              </div>
              <span className="text-muted-foreground mr-6 font-mono text-xs">
                {formatCurrency(expenses.total)}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {expenses.breakdown.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Нет прочих расходов за выбранный период
                  </p>
                ) : (
                  <>
                    {expenses.breakdown.map((item) => (
                      <DetailRow
                        key={item.name}
                        label={item.name}
                        value={formatCurrency(item.amount)}
                        hint={`${pct(item.amount, expenses.total)} от прочих расходов`}
                      />
                    ))}
                    <div className="border-t pt-2">
                      <DetailRow
                        label="Итого прочие расходы"
                        value={formatCurrency(expenses.total)}
                        bold
                      />
                    </div>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}

// ── Detail Row ────────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  hint,
  bold,
}: {
  label: string
  value: string
  hint?: string
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={`flex items-center gap-1 text-xs ${bold ? 'font-semibold' : 'text-muted-foreground'}`}
      >
        {label}
        {hint && <Hint text={hint} />}
      </span>
      <span className={`font-mono text-xs ${bold ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  )
}

// ── Waterfall Bar ─────────────────────────────────────────────────────────────

function WaterfallBar({ data }: { data: ProfitData }) {
  const { revenue, taxes, acquiring, salaries, rent, expenses } = data
  if (revenue === 0) return null

  const items = [
    { label: 'Налоги', value: taxes.total, color: 'bg-amber-400 dark:bg-amber-500' },
    { label: 'Эквайринг', value: acquiring.total, color: 'bg-blue-400 dark:bg-blue-500' },
    { label: 'Зарплаты', value: salaries.total, color: 'bg-purple-400 dark:bg-purple-500' },
    { label: 'Аренда', value: rent.total, color: 'bg-orange-400 dark:bg-orange-500' },
    { label: 'Прочее', value: expenses.total, color: 'bg-gray-400 dark:bg-gray-500' },
  ]

  const totalExpenses = items.reduce((s, i) => s + i.value, 0)
  const profitRatio = Math.max(0, (revenue - totalExpenses) / revenue)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[0.625rem]">
        <span className="text-muted-foreground">Структура расходов</span>
        <span className="text-muted-foreground">
          {pct(totalExpenses, revenue)} расходы ·{' '}
          {pct(Math.max(0, revenue - totalExpenses), revenue)} прибыль
        </span>
      </div>

      <div className="bg-muted flex h-3 overflow-hidden rounded-full">
        {items.map(
          (item) =>
            item.value > 0 && (
              <div
                key={item.label}
                className={`${item.color} transition-all`}
                style={{ width: `${(item.value / revenue) * 100}%` }}
                title={`${item.label}: ${formatCurrency(item.value)} (${pct(item.value, revenue)})`}
              />
            ),
        )}
        {profitRatio > 0 && (
          <div
            className="bg-emerald-400 transition-all dark:bg-emerald-500"
            style={{ width: `${profitRatio * 100}%` }}
            title={`Прибыль: ${formatCurrency(revenue - totalExpenses)} (${pct(revenue - totalExpenses, revenue)})`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items
          .filter((i) => i.value > 0)
          .map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <div className={`size-2 rounded-full ${item.color}`} />
              <span className="text-muted-foreground text-[0.5625rem]">{item.label}</span>
            </div>
          ))}
        {profitRatio > 0 && (
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-emerald-400 dark:bg-emerald-500" />
            <span className="text-muted-foreground text-[0.5625rem]">Прибыль</span>
          </div>
        )}
      </div>
    </div>
  )
}
