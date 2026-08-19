/**
 * Проблема, из-за которой заказ не может быть оформлен.
 *
 * Один и тот же тип используется дважды: `getCart` показывает проблемы заранее,
 * а чекаут пересобирает список внутри транзакции — и решает по нему. Показанный
 * список носит справочный характер: между показом и подтверждением цену и
 * остаток может изменить платформа.
 *
 * `PRICE_CHANGED` из `getCart` прийти не может: корзина не хранит снимок цены,
 * сравнивать в момент чтения не с чем. Эта проблема возникает только на чекауте,
 * где клиент присылает цены, которые он показал ученику.
 */
export type CheckoutIssue =
  | { kind: 'OUT_OF_STOCK'; shopItemId: number; name: string; available: number }
  | { kind: 'PRICE_CHANGED'; shopItemId: number; name: string; oldPrice: number; newPrice: number }
  | { kind: 'UNAVAILABLE'; shopItemId: number; name: string }
  | { kind: 'INSUFFICIENT_COINS'; needed: number; available: number }

export function issueMessage(issue: CheckoutIssue): string {
  switch (issue.kind) {
    case 'OUT_OF_STOCK':
      return issue.available === 0
        ? `«${issue.name}» закончился`
        : `«${issue.name}»: осталось только ${issue.available} шт.`
    case 'PRICE_CHANGED':
      return `«${issue.name}» подорожал: было ${issue.oldPrice}, стало ${issue.newPrice}`
    case 'UNAVAILABLE':
      return `«${issue.name}» больше не продаётся`
    case 'INSUFFICIENT_COINS':
      return `Не хватает коинов: нужно ${issue.needed}, есть ${issue.available}`
  }
}
