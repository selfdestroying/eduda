import type { Prisma } from '@repo/db'

/**
 * Минимум, из которого собирается подпись группы: кто её показывает — выбирает
 * это. Ключ `name` в типе обязателен (значение — nullable), и это здесь главное:
 * прежняя сигнатура принимала `name?`, поэтому выборка, забывшая его, молча
 * отдавала собранное имя вместо своего. Теперь такая выборка не соберётся.
 */
export const GROUP_LABEL_SELECT = {
  name: true,
  course: { select: { name: true } },
  schedules: { select: { dayOfWeek: true, time: true } },
} satisfies Prisma.GroupSelect

export type GroupLabel = Prisma.GroupGetPayload<{ select: typeof GROUP_LABEL_SELECT }>

const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

/**
 * Имя группы для показа: своё название, иначе «Курс Пн 16:00, Ср 16:00».
 *
 * Живёт в ядре, а не в платформе, потому что читателей двое — платформа и шоп.
 * Две копии этого правила уже стояли рядом, и разойтись им ничто не мешало:
 * школа увидела бы группу под одним именем, ученик под другим.
 */
export function getGroupName(group: GroupLabel): string {
  if (group.name) return group.name

  // Неделя с понедельника: `(d + 6) % 7` сдвигает воскресенье в конец.
  const sorted = [...group.schedules].sort(
    (a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7),
  )
  const parts = sorted.map((s) => `${DAYS_SHORT[s.dayOfWeek]} ${s.time}`)

  // `trim` — для группы без расписания: иначе остаётся хвостовой пробел.
  return `${group.course.name} ${parts.join(', ')}`.trim()
}
