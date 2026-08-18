/**
 * Статусы пакета. `PENDING` — счёт под него выставлен, но не оплачен: в очередь
 * списания пакет не встаёт и баланса не двигает. `ACTIVE` — выдан. `CANCELLED` —
 * отменён, непотраченный остаток снят.
 */
export const PACKAGE_STATUSES = ['PENDING', 'ACTIVE', 'CANCELLED'] as const

export type PackageStatusValue = (typeof PACKAGE_STATUSES)[number]

/**
 * Подписи — про деньги, а не про уроки: «Ждёт оплаты» → «Оплачен» читается парой, а
 * «Ждёт оплаты» → «Выдан» смешивало бы две оси.
 *
 * Ценой одной неточности: у пакета без счёта — подарочного или корректировки
 * перехода — статус тоже `ACTIVE`, и подпись скажет «Оплачен», хотя денег за него не
 * было. Корректировки из списка спрятаны, подарков пока нет; когда появятся, им
 * понадобится своё происхождение и своя подпись.
 */
export const PACKAGE_STATUS_LABELS: Record<PackageStatusValue, string> = {
  PENDING: 'Ждёт оплаты',
  ACTIVE: 'Оплачен',
  CANCELLED: 'Отменён',
}

/** Вариант бейджа из дизайн-системы: подложка в 10% цвета плюс текст тем же цветом. */
export const PACKAGE_STATUS_BADGE: Record<
  PackageStatusValue,
  'success' | 'destructive' | 'warning'
> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  CANCELLED: 'destructive',
}

export const PACKAGE_STATUS_OPTIONS = PACKAGE_STATUSES.map((value) => ({
  value,
  label: PACKAGE_STATUS_LABELS[value],
}))
