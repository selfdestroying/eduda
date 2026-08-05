/**
 * Одноразовая чистка: обнуляет `Student.birthDate` там, где дата явно засеяна
 * пачкой, а не заполнена школой. Признак — возраст больше `--max-age` (20): учеников
 * старше двадцати в этих школах не бывает.
 *
 * По умолчанию НИЧЕГО не меняет — печатает, что собирается тронуть:
 *
 *   pnpm --filter platform exec tsx scripts/clear-fake-birth-dates.ts
 *
 * Записывает только с флагом (вывод сухого прогона стоит сохранить — после
 * обнуления восстанавливать даты будет нечем):
 *
 *   pnpm --filter platform exec tsx scripts/clear-fake-birth-dates.ts --apply
 *
 * Можно ограничить одной школой: `--org=3`.
 */
import './load-env'

import { prisma } from '@repo/db'

/** Старше — значит дата фейковая. Меняется флагом `--max-age=N`. */
const DEFAULT_MAX_AGE = 20

const apply = process.argv.includes('--apply')

const arg = (name: string) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`))
  return found ? Number(found.slice(name.length + 3)) : null
}
const organizationId = arg('org')
const maxAge = arg('max-age') ?? DEFAULT_MAX_AGE

async function main() {
  if (organizationId !== null && !Number.isInteger(organizationId)) {
    throw new Error('--org ожидает число')
  }
  if (!Number.isInteger(maxAge) || maxAge < 0) {
    throw new Error('--max-age ожидает неотрицательное число')
  }

  // Граница как date-only строка: `birthDate` хранится в формате YYYY-MM-DD и
  // сравнивается лексикографически = хронологически.
  const cutoffDate = new Date()
  cutoffDate.setFullYear(cutoffDate.getFullYear() - maxAge)
  const cutoff = cutoffDate.toISOString().slice(0, 10)

  const where = {
    birthDate: { not: null, lt: cutoff },
    ...(organizationId ? { organizationId } : {}),
  }

  const students = await prisma.student.findMany({
    where,
    select: { id: true, organizationId: true, firstName: true, lastName: true, birthDate: true },
    orderBy: [{ organizationId: 'asc' }, { id: 'asc' }],
  })

  console.info(`Граница: birthDate < ${cutoff} (возраст больше ${maxAge})`)
  console.info(`Найдено учеников: ${students.length}`)

  if (students.length === 0) return

  // Сгруппировано по дате: одинаковая дата у десятков учеников — это и есть
  // след засева. Одиночные даты стоит глазами проверить перед --apply.
  const byDate = new Map<string, number>()
  for (const s of students) {
    const key = `${s.organizationId}\t${s.birthDate}`
    byDate.set(key, (byDate.get(key) ?? 0) + 1)
  }
  console.info('\norg\tдата\t\tсколько')
  for (const [key, count] of [...byDate].sort((a, b) => b[1] - a[1])) {
    console.info(`${key}\t${count}`)
  }

  console.info('\nСписок (id, школа, ученик, дата):')
  for (const s of students) {
    console.info(`${s.id}\t${s.organizationId}\t${s.lastName} ${s.firstName}\t${s.birthDate}`)
  }

  if (!apply) {
    console.info('\nСухой прогон — ничего не изменено. Повторите с --apply.')
    return
  }

  const { count } = await prisma.student.updateMany({ where, data: { birthDate: null } })
  console.info(`\nОбнулено дат: ${count}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
