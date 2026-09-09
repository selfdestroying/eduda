import { todayYmdInTz } from '@repo/core/timezone'

/** Живёт в дизайн-системе; ре-экспорт, чтобы `@/src/lib/utils` остался одной точкой входа. */
export { cn } from '@repo/ui/lib/utils'

/**
 * Имя группы для показа. Живёт в `@repo/core/group` — правило общее с платформой:
 * разойдись копии, и ученик увидел бы группу не под тем именем, что назвала школа.
 */
export { GROUP_LABEL_SELECT, getGroupName, type GroupLabel } from '@repo/core/group'

/**
 * Осеннее оформление: весь сентябрь баланс коинов в шапке подсвечен тёплым
 * градиентом. Копия предиката из платформы (`apps/platform/src/lib/utils.ts`) —
 * как и `date.ts`, общий пакет ради двух строк заводить рано.
 */
export const isSeptember = (tz: string) => todayYmdInTz(tz).slice(5, 7) === '09'

/** Поздравление в профиле — только 1 сентября, дальше снова «Личный кабинет». */
export const isKnowledgeDay = (tz: string) => todayYmdInTz(tz).slice(5) === '09-01'
