'use client'

import { formatDateOnly } from '@/src/lib/timezone'
import { formatCurrency } from '@/src/lib/utils'
import { Badge } from '@repo/ui/components/badge'
import { Skeleton } from '@repo/ui/components/skeleton'
import { PACKAGE_STATUS_BADGE, PACKAGE_STATUS_LABELS, type PackageStatusValue } from '../constants'
import { usePackageDetailsQuery } from '../queries'

export default function PackageDetails({ packageId, open }: { packageId: number; open: boolean }) {
  const { data, isLoading, isError } = usePackageDetailsQuery(packageId, open)

  if (isLoading) return <Skeleton className="m-3 h-4 w-96" />

  if (isError || !data) {
    return <div className="text-destructive p-3 text-sm">Не удалось загрузить пакет.</div>
  }

  const { product, productName, payment } = data

  // Счёта может не быть вовсе: подарок или корректировка перехода.
  if (!payment) {
    return (
      <div className="text-muted-foreground p-3 text-sm">
        Счёта нет: пакет выдан без оплаты — подарок или корректировка.
      </div>
    )
  }

  return (
    // Своя таблица, а не сетка родительской: колонки счёта с колонками пакета не
    // совпадают ни числом, ни смыслом, и подстраивать одни под другие значило бы
    // связать две разные разметки. Прокрутка своя — на телефоне шесть полей в
    // ширину не влезают.
    <div className="overflow-x-auto p-3">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="text-muted-foreground text-left text-xs">
            <th className="pb-1 font-normal">Счёт</th>
            <th className="pb-1 font-normal">Сумма</th>
            <th className="pb-1 font-normal">Дата</th>
            <th className="pb-1 font-normal">Метод</th>
            <th className="pb-1 font-normal">Состояние</th>
            <th className="pb-1 font-normal">Продукт</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="tabular-nums">№ {payment.id}</td>
            <td className="tabular-nums">{formatCurrency(payment.price)}</td>
            <td className="tabular-nums">{formatDateOnly(payment.date)}</td>
            <td>
              {payment.paymentMethod?.name ?? (
                <span className="text-muted-foreground">не указан</span>
              )}
            </td>
            <td>
              {/* `PaymentStatus` и `PackageStatus` — разные перечисления с одними и
                  теми же значениями, поэтому подписи общие. */}
              <Badge variant={PACKAGE_STATUS_BADGE[payment.status as PackageStatusValue]}>
                {PACKAGE_STATUS_LABELS[payment.status as PackageStatusValue]}
              </Badge>
            </td>
            <td>
              {/* Снимок названия на момент продажи, а не текущее имя: продукт могли
                  переименовать или удалить. */}
              {productName || product?.name || (
                <span className="text-muted-foreground">не указан</span>
              )}
              {product && !product.isActive && (
                <Badge variant="outline" className="ml-2">
                  снят с продажи
                </Badge>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
