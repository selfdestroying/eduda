/**
 * Сверка сводки записей «ученик — группа» с плоским списком.
 *
 *   Σ count по строкам сводки = число записей при том же отборе — в КАЖДОМ разрезе
 *   students ≤ count в каждой строке
 *   ключ строки уникален
 *
 * Свёртка обязана класть каждую запись ровно в одну корзину. Ломается это тихо и
 * в одном месте: у группы бывает несколько преподавателей, и разложить её по
 * каждому значило бы посчитать запись дважды — сводка показала бы больше людей,
 * чем есть. Поэтому набор преподавателей ведёт одну общую строку, и проверка
 * следит, чтобы такие строки в выборке вообще были: без них равенство сумм
 * ничего не доказывает.
 *
 *   pnpm --filter platform exec tsx scripts/check-enrollment-groups.ts
 */
import './load-env'

import { prisma } from '@repo/db'
import assert from 'node:assert/strict'
import {
  foldEnrollmentGroups,
  sortEnrollmentGroups,
  type EnrollmentDimensions,
} from '../src/features/students/enrollments/group'
import { EnrollmentGroupBy } from '../src/features/students/enrollments/schemas'
import { ENROLLMENT_GROUP_SELECT } from '../src/features/students/enrollments/types'
import { getGroupName } from '../src/lib/utils'

/** Тот же статус, что показывает страница «Активные». */
const ACTIVE = ['ACTIVE'] as const

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } })

  let checkedOrgs = 0
  let pairedTeacherRows = 0
  let multiGroupStudents = 0

  for (const org of orgs) {
    const rows = await prisma.studentGroup.findMany({
      where: { organizationId: org.id, status: { in: [...ACTIVE] } },
      // Тот же `select`, что кормит свёртку в экшене: свой список полей здесь
      // молча разъехался бы с ним при первой же новой колонке.
      select: ENROLLMENT_GROUP_SELECT,
    })
    if (rows.length === 0) continue
    checkedOrgs++

    const dimensions: EnrollmentDimensions[] = rows.map((row) => {
      const teachers = [...row.group.teachers].map((t) => t.teacher).sort((a, b) => a.id - b.id)
      if (teachers.length > 1) pairedTeacherRows++
      return {
        studentId: row.studentId,
        groupId: row.group.id,
        groupName: getGroupName(row.group),
        courseId: row.group.course.id,
        courseName: row.group.course.name,
        locationId: row.group.location?.id ?? null,
        locationName: row.group.location?.name ?? null,
        teacherKey: teachers.length === 0 ? 'none' : teachers.map((t) => t.id).join(','),
        teachers,
      }
    })

    const distinctStudents = new Set(dimensions.map((d) => d.studentId)).size
    if (distinctStudents < rows.length) multiGroupStudents++

    const report: string[] = []
    for (const by of EnrollmentGroupBy.options) {
      const folded = sortEnrollmentGroups(foldEnrollmentGroups(by, dimensions), null)

      const sum = folded.reduce((acc, row) => acc + row.count, 0)
      assert.equal(
        sum,
        rows.length,
        `${org.name}/${by}: сумма строк ${sum} ≠ ${rows.length} записей — запись попала не в одну корзину`,
      )

      const keys = new Set(folded.map((row) => row.key))
      assert.equal(keys.size, folded.length, `${org.name}/${by}: ключи строк не уникальны`)

      for (const row of folded) {
        assert.ok(
          row.students <= row.count,
          `${org.name}/${by}/${row.label}: учеников ${row.students} больше, чем записей ${row.count}`,
        )
        assert.ok(row.students > 0, `${org.name}/${by}/${row.label}: строка без учеников`)
        assert.ok(row.label.length > 0, `${org.name}/${by}: строка без подписи`)
      }

      // Ссылки проставлены каждая в своём разрезе: `groupId` только там, где
      // строка — ровно одна группа, `teachers` только в разрезе преподавателей.
      // Иначе ссылка вела бы в произвольную из нескольких.
      const withGroup = folded.filter((row) => row.groupId !== null).length
      assert.equal(
        withGroup,
        by === 'group' ? folded.length : 0,
        `${org.name}/${by}: ссылка на группу проставлена не по правилу`,
      )
      const withTeachers = folded.filter((row) => row.teachers !== null).length
      assert.equal(
        withTeachers,
        by === 'teacher' ? folded.length : 0,
        `${org.name}/${by}: список преподавателей проставлен не по правилу`,
      )

      // Подпись обязана сойтись со списком: имена больше не приходят готовой
      // строкой, и разъехаться им негде — но проверить дешевле, чем поверить.
      if (by === 'teacher') {
        for (const row of folded) {
          const names = row.teachers!.map((teacher) => teacher.name).join(', ')
          assert.equal(
            row.label,
            names || 'Без преподавателя',
            `${org.name}/teacher: подпись «${row.label}» не совпала со списком`,
          )
          const ids = row.teachers!.map((teacher) => teacher.id)
          assert.deepEqual(
            [...ids].sort((a, b) => a - b),
            ids,
            `${org.name}/teacher/${row.label}: преподаватели не по возрастанию id — ключ корзины разъедется`,
          )
        }
      }

      report.push(`${by} ${folded.length}`)
    }

    console.log(
      `${org.name}: ${rows.length} записей / ${distinctStudents} учеников → ${report.join(', ')}`,
    )
  }

  assert.ok(checkedOrgs > 0, 'ни в одной школе нет активных записей — сверять нечего')
  assert.ok(
    pairedTeacherRows > 0,
    'групп с двумя преподавателями в выборке нет — равенство сумм по свёртке «teacher» ничего не доказывает',
  )
  assert.ok(
    multiGroupStudents > 0,
    'учеников из нескольких групп в выборке нет — разница между «Записей» и «Учеников» ничего не доказывает',
  )

  console.log(
    `\nСводка записей сходится с плоским списком во всех разрезах ` +
      `(записей с парой преподавателей: ${pairedTeacherRows}).`,
  )
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
