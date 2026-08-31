'use client'

import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Checkbox } from '@repo/ui/components/checkbox'
import { CustomCombobox } from '@repo/ui/components/custom-combobox'
import { Field, FieldLabel } from '@repo/ui/components/field'
import {
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/sheet'
import type { StudentDetail } from '@/src/features/students/types'
import {
  useTransferablePackagesQuery,
  useTransferPackagesMutation,
  useTransferPreviewQuery,
} from '@/src/features/wallets/queries'
import { getWalletLabel } from '@/src/features/wallets/utils'
import { formatDateOnly } from '@/src/lib/timezone'
import { Loader, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

interface TransferPackagesSheetProps {
  student: StudentDetail
  fromWalletId: number
  onDone: () => void
}

const money = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

/**
 * Перенос пакетов на другой кошелёк того же ученика.
 *
 * Переносится пакет целиком, а не уроки: урок несёт цену своего пакета. Поэтому
 * здесь выбирают пакеты галочками, а не вводят количество.
 *
 * Два предупреждения показываются до подтверждения, потому что задним числом их не
 * увидеть ни в одном отчёте: переоценка (перенесённый пакет старше головы очереди и
 * начнёт задавать цену) и осиротевшие группы (у источника не осталось пакетов, а
 * группы на нём висят — их занятия будут ждать оплаты).
 */
export function TransferPackagesSheet({
  student,
  fromWalletId,
  onDone,
}: TransferPackagesSheetProps) {
  const [selected, setSelected] = useState<number[]>([])
  const [toWalletId, setToWalletId] = useState<string>('')

  const { data: packages, isPending } = useTransferablePackagesQuery(fromWalletId)
  const transferMutation = useTransferPackagesMutation(student.id)

  const targetId = toWalletId ? Number(toWalletId) : null
  const { data: preview } = useTransferPreviewQuery(selected, targetId)

  const source = student.wallets.find((w) => w.id === fromWalletId)
  const targets = student.wallets.filter((w) => w.status === 'ACTIVE' && w.id !== fromWalletId)

  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)))

  const submit = () => {
    if (selected.length === 0 || targetId === null) return
    transferMutation.mutate(
      { packageIds: selected, toWalletId: targetId },
      { onSuccess: () => onDone() },
    )
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Перенести пакеты</SheetTitle>
        <SheetDescription>
          {source ? getWalletLabel(source) : 'Кошелёк'} — выберите, что перенести и куда. Переезжает
          пакет целиком: уроки несут цену своего пакета.
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 overflow-y-auto px-4">
        <Field>
          <FieldLabel>Пакеты</FieldLabel>
          {isPending ? (
            <p className="text-muted-foreground text-sm">Загрузка…</p>
          ) : !packages || packages.length === 0 ? (
            <p className="text-muted-foreground text-sm">Переносить нечего: пакетов нет.</p>
          ) : (
            <div className="space-y-1">
              {packages.map((p) => (
                <label
                  key={p.id}
                  className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                >
                  <Checkbox
                    checked={selected.includes(p.id)}
                    onCheckedChange={(val) => toggle(p.id, Boolean(val))}
                  />
                  <span className="flex-1 truncate">
                    {p.productName || 'Пакет'}
                    <span className="text-muted-foreground"> · {formatDateOnly(p.date)}</span>
                  </span>
                  {p.status === 'PENDING' ? (
                    <Badge variant="outline" className="shrink-0 px-1 py-0 text-[0.625rem]">
                      Ждёт оплаты
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground shrink-0">
                      {p.remaining} из {p.lessonCount} ур. · {money(p.unitPrice)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </Field>

        <Field>
          <FieldLabel>Кошелёк-получатель</FieldLabel>
          {targets.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              У ученика нет другого активного кошелька — сначала создайте его.
            </p>
          ) : (
            <CustomCombobox
              items={targets.map((w) => ({ label: getWalletLabel(w), value: w.id.toString() }))}
              value={
                targetId
                  ? {
                      label: getWalletLabel(targets.find((w) => w.id === targetId)!),
                      value: toWalletId,
                    }
                  : null
              }
              onValueChange={(item) => setToWalletId(item?.value ?? '')}
              placeholder="Выберите кошелёк"
            />
          )}
        </Field>

        {preview && (
          <div className="bg-muted/50 space-y-1 rounded-lg border p-3 text-xs">
            <div className="font-medium">
              Переедет пакетов: {preview.packages}, уроков: {preview.moved}
            </div>
            <div className="text-muted-foreground">
              {preview.source.name || 'Источник'}: {preview.source.before} → {preview.source.after}{' '}
              ур.
            </div>
            <div className="text-muted-foreground">
              {preview.target.name || 'Получатель'}: {preview.target.before} →{' '}
              {preview.target.after} ур.
            </div>
            {preview.willSettle > 0 && (
              <div className="text-muted-foreground">
                Закроется занятий, ждущих оплаты: {preview.willSettle} из {preview.unpaidOnTarget}
              </div>
            )}
          </div>
        )}

        {preview?.reprices && (
          <Alert>
            <TriangleAlert />
            <AlertTitle>Цена ближайших занятий изменится</AlertTitle>
            <AlertDescription>
              Переносимый пакет старше, поэтому встанет в очереди первым: ближайшие{' '}
              {preview.reprices.lessons} занятий спишутся по {money(preview.reprices.price)} вместо{' '}
              {money(preview.reprices.was)}. Так и должно быть — за эти уроки заплатили по старой
              цене.
            </AlertDescription>
          </Alert>
        )}

        {preview && preview.orphanedGroups.length > 0 && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>У кошелька не останется пакетов</AlertTitle>
            <AlertDescription>
              Занятия этих групп будут ждать оплаты: {preview.orphanedGroups.join(', ')}.
              Перепривяжите их к другому кошельку — кнопка со стрелками в строке группы.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <SheetFooter>
        <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
        <Button
          onClick={submit}
          disabled={selected.length === 0 || targetId === null || transferMutation.isPending}
        >
          {transferMutation.isPending && <Loader className="animate-spin" />}
          Перенести
        </Button>
      </SheetFooter>
    </>
  )
}
