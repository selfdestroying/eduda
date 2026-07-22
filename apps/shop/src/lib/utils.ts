/** Живёт в дизайн-системе; ре-экспорт, чтобы `@/src/lib/utils` остался одной точкой входа. */
export { cn } from '@repo/ui/lib/utils'

const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

/**
 * Имя группы для показа: своё название, иначе «Курс Пн 16:00, Ср 16:00».
 * Копия правила из платформы — оно должно совпадать, иначе ученик увидит
 * группу не под тем именем, что назвала школа.
 */
export function getGroupName(group: {
  name?: string | null
  course: { name: string }
  schedules: Array<{ dayOfWeek: number; time: string }>
}): string {
  if (group.name) return group.name
  const sorted = [...group.schedules].sort(
    (a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7),
  )
  const parts = sorted.map((s) => `${DAYS_SHORT[s.dayOfWeek]} ${s.time}`)
  return `${group.course.name} ${parts.join(', ')}`.trim()
}

export function getFullName(firstName: string, lastName: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName
}
