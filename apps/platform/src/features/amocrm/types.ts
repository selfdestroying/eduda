/**
 * Ответы amoCRM — ровно те поля, которые мы читаем.
 *
 * Полные схемы объектов amo заметно больше. Переносить их целиком незачем: поле,
 * которое никто не читает, нельзя ни проверить, ни заметить, когда CRM его
 * переименует.
 */

/** Обёртка значения кастомного поля: amo всегда кладёт их списком объектов. */
export type AmoFieldValue<T> = { value: T }

export type AmoCustomField = {
  field_id: number
  values: unknown[]
}

/** Событие журнала amo. Нас интересует единственный тип — `invoice_paid`. */
export type AmoEvent = {
  id: string
  type: string
  created_at: number
  /** Счёт, которого касается событие. */
  _embedded: { entity: { id: number } }
}

export type AmoEventsResponse = {
  _embedded?: { events: AmoEvent[] }
  /** Ссылка на следующую страницу; на последней её нет. */
  _links?: { next?: { href: string } }
}

/** Позиция счёта — значение поля «Позиции счета». */
export type AmoInvoiceItem = {
  product_id: number
  description: string
  unit_price: number
  quantity: number
  total_sum: number
}

/** Плательщик — контакт-родитель, а не ученик. */
export type AmoPayer = {
  name: string
  entity_id: number
  phone?: string
}

/** Счёт — элемент каталога счетов. Всё содержательное лежит в кастомных полях. */
export type AmoInvoice = {
  id: number
  name: string
  created_at: number
  custom_fields_values: AmoCustomField[] | null
}

export type AmoLead = {
  id: number
  name: string
}

export type AmoLinksResponse = {
  _embedded?: { links: { to_entity_id: number; to_entity_type: string }[] }
}
