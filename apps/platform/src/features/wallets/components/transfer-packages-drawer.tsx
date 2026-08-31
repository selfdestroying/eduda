'use client'

import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Checkbox } from '@repo/ui/components/checkbox'
import { ScrollArea } from '@repo/ui/components/scroll-area'
import { Switch } from '@repo/ui/components/switch'
import { Field, FieldLabel } from '@repo/ui/components/field'
import {
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@repo/ui/components/drawer'
import type { StudentDetail } from '@/src/features/students/types'
import {
  useTransferablePackagesQuery,
  useTransferPackagesMutation,
  useTransferPreviewQuery,
} from '@/src/features/wallets/queries'
import { WalletSelect } from '@/src/features/wallets/components/wallet-select'
import { getWalletLabel } from '@/src/features/wallets/utils'
import { formatDateOnly } from '@/src/lib/timezone'
import { cn } from '@/src/lib/utils'
import { Loader, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

const money = (v: number) => `${v.toLocaleString('ru-RU')} ₽`

/** «1 пакет / 2 пакета / 5 пакетов». Локальный: другого места со склонением пока нет. */
const plural = (n: number, one: string, few: string, many: string) => {
  const tens = n % 100
  if (tens > 10 && tens < 20) return many
  const ones = n % 10
  if (ones === 1) return one
  if (ones >= 2 && ones <= 4) return few
  return many
}

interface TransferPackagesDrawerProps {
  student: StudentDetail
  fromWalletId: number
  onDone: () => void
}

/**
 * Перенос пакетов на другой кошелёк того же ученика.
 *
 * Переносится пакет целиком, а не уроки: урок несёт цену своего пакета. Поэтому
 * здесь выбирают пакеты галочками, а не вводят количество.
 *
 * В списке только пакеты с непотраченным остатком и ждущие оплаты: выработанный
 * переносить незачем — уроки по нему отходили, а цена списаний заморожена в проводках.
 *
 * Два предупреждения показываются до подтверждения, потому что задним числом их не
 * увидеть ни в одном отчёте: переоценка (перенесённый пакет старше головы очереди и
 * начнёт задавать цену) и осиротевшие группы (источнику нечем платить, а группы на
 * нём висят — их занятия будут ждать оплаты).
 */
export function TransferPackagesDrawer({
  student,
  fromWalletId,
  onDone,
}: TransferPackagesDrawerProps) {
  const [selected, setSelected] = useState<number[]>([])
  const [toWalletId, setToWalletId] = useState<string>('')
  const [movePackages, setMovePackages] = useState(true)

  const { data: packages, isPending } = useTransferablePackagesQuery(fromWalletId)
  const transferMutation = useTransferPackagesMutation(student.id)

  const targetId = toWalletId ? Number(toWalletId) : null
  const { data: preview, isFetching } = useTransferPreviewQuery(selected, targetId)

  const source = student.wallets.find((w) => w.id === fromWalletId)
  const targets = student.wallets.filter((w) => w.status === 'ACTIVE' && w.id !== fromWalletId)

  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)))

  // Неоплаченный меняет только владельца: баланса он не двигал и двигать не будет,
  // пока счёт не подтвердят. В «переедет уроков» его нет, и это надо назвать словами.
  const pending =
    packages?.filter((p) => selected.includes(p.id) && p.status === 'PENDING').length ?? 0

  const submit = () => {
    if (selected.length === 0 || targetId === null) return
    transferMutation.mutate(
      { packageIds: selected, toWalletId: targetId },
      { onSuccess: () => onDone() },
    )
  }

  return (
    <>
      <DrawerHeader className="pb-4">
        <DrawerTitle>Перенос</DrawerTitle>
        <DrawerDescription>Из «{source ? getWalletLabel(source) : 'Кошелёк'}».</DrawerDescription>
      </DrawerHeader>

      {/* Прокрутка внутри панели: шапка и кнопки остаются на месте, едет содержимое.
          `min-h-0` обязателен — без него flex-элемент не даёт себя сжать. */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4">
          <Field>
            <FieldLabel>Кошелёк-получатель</FieldLabel>
            {targets.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                У ученика нет другого активного кошелька — сначала создайте его.
              </p>
            ) : (
              <WalletSelect wallets={targets} value={toWalletId} onValueChange={setToWalletId} />
            )}
          </Field>

          <Field>
            {/* Переключатель готовит окно к слиянию с перепривязкой групп: скоро
                отсюда можно будет перевесить группу, не трогая деньги. Пока выключать
                нечего в пользу чего, поэтому по умолчанию включён. */}
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="transfer-packages-toggle">Пакеты</FieldLabel>
              <Switch
                id="transfer-packages-toggle"
                checked={movePackages}
                onCheckedChange={(on) => {
                  setMovePackages(Boolean(on))
                  if (!on) setSelected([])
                }}
              />
            </div>
            {!movePackages ? (
              <p className="text-muted-foreground text-sm">Пакеты остаются на этом кошельке.</p>
            ) : isPending ? (
              <p className="text-muted-foreground text-sm">Загрузка…</p>
            ) : !packages || packages.length === 0 ? (
              <p className="text-muted-foreground text-sm">Нет доступных пакетов</p>
            ) : (
              <div className="space-y-2">
                {packages.map((p) => (
                  <label
                    key={p.id}
                    className="hover:bg-muted/50 has-data-checked:border-primary/50 has-data-checked:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={selected.includes(p.id)}
                      onCheckedChange={(val) => toggle(p.id, Boolean(val))}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {p.productName || 'Пакет'}
                        </span>
                        {p.status === 'PENDING' && (
                          <Badge variant="outline" className="shrink-0">
                            Ждёт оплаты
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                        <span>{formatDateOnly(p.date)}</span>
                        <span aria-hidden>·</span>
                        {p.status === 'PENDING' ? (
                          <span>
                            {p.lessonCount} ур. за {money(p.price)}
                          </span>
                        ) : (
                          <>
                            <span className="text-foreground font-medium">
                              осталось {p.remaining} из {p.lessonCount} ур.
                            </span>
                            <span aria-hidden>·</span>
                            <span>{money(p.unitPrice)} за урок</span>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </Field>

          {/* Пока предпросмотр пересчитывается, показываем прежние цифры —
              приглушёнными, чтобы не выдать их за актуальные. */}
          <div className={cn('space-y-4 transition-opacity', isFetching && 'opacity-60')}>
            {preview && (
              <div className="bg-muted/50 space-y-3 rounded-lg border p-3">
                {/* Баланс до и после — обеими сторонами сразу: перенос всегда про пару
                кошельков, и одна цифра без второй ничего не говорит. */}
                <div className="space-y-1 text-xs">
                  {(
                    [
                      [preview.source.name || 'Источник', preview.source],
                      [preview.target.name || 'Получатель', preview.target],
                    ] as const
                  ).map(([name, side]) => (
                    <div key={name} className="flex items-baseline justify-between gap-3">
                      <span className="text-muted-foreground truncate">{name}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="text-muted-foreground">{side.before}</span>
                        <span className="text-muted-foreground mx-1" aria-label="становится">
                          →
                        </span>
                        <span className="font-medium">{side.after}</span> ур.
                      </span>
                    </div>
                  ))}
                </div>

                {(pending > 0 || preview.willSettle > 0) && (
                  <div className="text-muted-foreground space-y-1 border-t pt-2 text-xs">
                    {pending > 0 && (
                      <p>
                        {pending} {plural(pending, 'пакет ждёт', 'пакета ждут', 'пакетов ждут')}{' '}
                        оплаты: их уроки зачислятся получателю после подтверждения счёта.
                      </p>
                    )}
                    {preview.willSettle > 0 && (
                      <p>
                        Закроет {preview.willSettle}{' '}
                        {plural(preview.willSettle, 'занятие', 'занятия', 'занятий')} из{' '}
                        {preview.unpaidOnTarget}, ждущих оплаты.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {preview?.reprices && (
              <Alert>
                <TriangleAlert />
                <AlertTitle>Цена ближайших занятий изменится</AlertTitle>
                <AlertDescription>
                  Пакет старше — встанет в очередь первым. Ближайшие {preview.reprices.lessons}{' '}
                  {plural(preview.reprices.lessons, 'занятие', 'занятия', 'занятий')} спишутся по{' '}
                  {money(preview.reprices.price)} вместо {money(preview.reprices.was)}.
                </AlertDescription>
              </Alert>
            )}

            {preview && preview.orphanedGroups.length > 0 && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Кошелёк останется без уроков</AlertTitle>
                <AlertDescription>
                  Занятия будут ждать оплаты: {preview.orphanedGroups.join(', ')}.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </ScrollArea>

      <DrawerFooter className="pt-4">
        <DrawerClose render={<Button variant="outline" />}>Отмена</DrawerClose>
        <Button
          onClick={submit}
          disabled={selected.length === 0 || targetId === null || transferMutation.isPending}
        >
          {transferMutation.isPending && <Loader className="animate-spin" />}
          Перенести
        </Button>
      </DrawerFooter>
    </>
  )
}
