import { DateOnlySchema } from '@/src/lib/timezone'
import * as z from 'zod'

/**
 * День продажи. Строже `DateOnlySchema`: тот проверяет только форму записи, а
 * «2026-02-31» ей удовлетворяет. Здесь дата ещё и должна существовать в календаре —
 * иначе в `Package.date` уляжется день, которого не было.
 */
const PackageDateSchema = z.string('Выберите дату').refine(
  (val) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false

    const [year, month, day] = val.split('-').map(Number)
    const date = new Date(val)

    return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day
  },
  { message: 'Некорректная дата' },
)

/**
 * Всё состояние таблицы пакетов: страница, порядок и отбор. Сервер по нему строит
 * `where`/`orderBy`/`skip`/`take` и возвращает срез вместе с общим числом строк —
 * браузер больше ничего не отбирает и не сортирует сам.
 *
 * `sort.id` не сужен до списка колонок намеренно: в адресах живут id, которых уже
 * нет (колонки переименовывались), и валидация роняла бы запрос вместо того, чтобы
 * молча отдать порядок по умолчанию. Белый список — на сервере.
 */
export const PackageListSchema = z.object({
  page: z.number().int().min(0).default(0),
  // Верхняя граница — чтобы подобранный руками `pageSize=100000` не превращался в
  // выгрузку всей истории одним запросом.
  pageSize: z.number().int().min(1).max(100).default(10),
  sort: z.object({ id: z.string(), desc: z.boolean() }).nullish(),
  // Ограничение длины — не про валидацию ввода, а про стоимость: `contains` идёт
  // последовательным просмотром, и незачем пускать в него полотно текста.
  search: z.string().trim().max(100).optional(),
  // Обе границы включительно и сравниваются лексикографически: `Package.date` —
  // date-only строка `YYYY-MM-DD`. Любая может отсутствовать: «с такого-то дня» и
  // «до такого-то» законны, а без обеих период не ограничен вовсе.
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  managerIds: z.array(z.number().int().positive()).default([]),
  statuses: z.array(z.enum(['PENDING', 'ACTIVE', 'CANCELLED'])).default([]),
  priceMin: z.number().int().nullish(),
  priceMax: z.number().int().nullish(),
  lessonsMin: z.number().int().nullish(),
  lessonsMax: z.number().int().nullish(),
})

export const CreatePackageSchema = z.object({
  studentId: z.int('Выберите студента').positive('Выберите студента'),
  walletId: z.int('Выберите кошелёк').positive('Выберите кошелёк'),
  /**
   * Что продали — строка прайс-листа. Обязателен: из него подставляются сумма и
   * количество занятий, и без него форме нечем их заполнить. (В базе
   * `Payment.productId` по-прежнему nullable: у оплат, заведённых до появления
   * справочника, продукта нет.)
   *
   * Название сюда не приходит: снимок `Payment.productName` сервер читает из
   * продукта, чтобы клиент не мог прислать чужое.
   */
  productId: z.int('Выберите продукт').positive('Выберите продукт'),
  /**
   * Подставляются из продукта и правятся руками: разовая скидка или доплата не
   * должна плодить строку прайса. Поэтому сервер берёт их из запроса, а не из
   * продукта, — премия в бонусной схеме считается от продукта, и скидка в неё
   * не поедет.
   */
  lessonCount: z.number('Укажите количество занятий').int().positive(),
  price: z.number('Укажите сумму').int().positive(),
  date: PackageDateSchema,
  /**
   * Деньги уже получены. По умолчанию да — так вносят наличные и переводы, то есть
   * почти всегда. Снятая галочка оставляет счёт неоплаченным: пакет заведён, но
   * уроки не выданы, пока оплату не подтвердят.
   */
  received: z.boolean(),
  paymentMethodId: z.number().int().positive().nullable().optional(),
  /** Кто продал: не автор записи, а тот, кто договорился. */
  managerId: z.number().int().positive().nullable().optional(),
})

/**
 * Ссылка на счёт — отмена и подтверждение. Отдельно от `PackageIdSchema`, хотя поле
 * то же: перепутать id счёта с id пакета в этих экшенах значит отменить не то, а
 * типы одинаковы и подсказать некому. Разные имена — единственное, что здесь их
 * различает.
 */
export const PaymentIdSchema = z.object({
  id: z.number().int().positive(),
})

/** Ссылка на пакет — отмена и панель раскрытой строки. */
export const PackageIdSchema = z.object({
  id: z.number().int().positive(),
})

/**
 * Разбор неразобранной оплаты — та же продажа плюс ссылка на исходную строку:
 * форма у них одна, и расходиться этим двум наборам полей нельзя.
 */
export const ResolveUnprocessedPaymentSchema = CreatePackageSchema.extend({
  unprocessedPaymentId: z.number().int().positive(),
})

export const DeleteUnprocessedPaymentSchema = z.object({
  id: z.number().int().positive(),
})

export type PackageListSchemaType = z.infer<typeof PackageListSchema>
export type CreatePackageSchemaType = z.infer<typeof CreatePackageSchema>
export type PaymentIdSchemaType = z.infer<typeof PaymentIdSchema>
export type PackageIdSchemaType = z.infer<typeof PackageIdSchema>
export type ResolveUnprocessedPaymentSchemaType = z.infer<typeof ResolveUnprocessedPaymentSchema>
export type DeleteUnprocessedPaymentSchemaType = z.infer<typeof DeleteUnprocessedPaymentSchema>
