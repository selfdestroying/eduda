/**
 * Сверка сводки пропусков с плоским списком.
 *
 *   Σ count по строкам сводки    = число пропусков при том же отборе
 *   Σ unwarned по строкам        = непредупреждённых пропусков
 *   Σ lost по строкам            = потерянные деньги по всей выборке
 *   students ≤ count в каждой строке; ключ строки уникален
 *
 * Свёртка обязана класть каждый пропуск ровно в одну корзину. Ломается это тихо и
 * в одном месте: у урока бывает несколько преподавателей, и разложить пропуск по
 * каждому значило бы посчитать его дважды — и штуками, и рублями. Поэтому набор
 * ведёт одну общую строку, и проверка следит, чтобы такие уроки в выборке вообще
 * были: без них равенство сумм ничего не доказывает.
 *
 *   pnpm --filter platform exec tsx scripts/check-absent-groups.ts
 */
import './load-env'

import { prisma } from '@repo/db'
import assert from 'node:assert/strict'
import {
  foldAbsentGroups,
  sortAbsentGroups,
  type AbsentDimensions,
} from '../src/features/students/absent/group'
import { AbsentGroupBy } from '../src/features/students/absent/schemas'
import { ABSENT_GROUP_SELECT } from '../src/features/students/absent/types'
import { getFullName, getGroupName } from '../src/lib/utils'

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } })

  let checkedOrgs = 0
  let pairedTeacherRows = 0
  let multiGroupStudents = 0
  let orgsWithMoney = 0
  let orgsWithSaved = 0

  for (const org of orgs) {
    const rows = await prisma.attendance.findMany({
      // Тот же отбор, что у `absentWhere` без фильтров тулбара: отменённого урока
      // не было — значит не было и пропуска на нём.
      where: { organizationId: org.id, status: 'ABSENT', lesson: { status: 'ACTIVE' } },
      // Тот же `select`, что кормит свёртку в экшене. Свой список полей здесь уже
      // разъезжался: добавленную в экшен отработку скрипт не увидел и упал.
      select: ABSENT_GROUP_SELECT,
    })
    if (rows.length === 0) continue
    checkedOrgs++

    const dimensions: AbsentDimensions[] = rows.map((row) => {
      const teachers = [...row.lesson.teachers].map((t) => t.teacher).sort((a, b) => a.id - b.id)
      if (teachers.length > 1) pairedTeacherRows++
      return {
        studentId: row.studentId,
        studentName: getFullName(row.student.firstName, row.student.lastName),
        groupId: row.lesson.group.id,
        groupName: getGroupName(row.lesson.group),
        courseId: row.lesson.group.course.id,
        courseName: row.lesson.group.course.name,
        locationId: row.lesson.group.location?.id ?? null,
        locationName: row.lesson.group.location?.name ?? null,
        teacherKey: teachers.length === 0 ? 'none' : teachers.map((t) => t.id).join(','),
        teachers,
        isWarned: row.isWarned === true,
        price: row.price,
        makeupAttended: row.makeupAttendance?.status === 'PRESENT',
        makeupPrice: row.makeupAttendance?.price ?? null,
      }
    })

    // Эталоны считаем прямо по строкам, а не свёрткой: иначе проверка сверяла бы
    // свёртку сама с собой.
    const unwarned = dimensions.filter((d) => !d.isWarned).length
    const lost = dimensions.reduce((sum, d) => (d.isWarned ? sum : sum + (d.price ?? 0)), 0)
    const saved = dimensions.reduce(
      (sum, d) => (d.isWarned && d.makeupAttended ? sum + (d.makeupPrice ?? 0) : sum),
      0,
    )
    if (lost > 0) orgsWithMoney++
    if (saved > 0) orgsWithSaved++

    const distinctStudents = new Set(dimensions.map((d) => d.studentId)).size
    if (distinctStudents < rows.length) multiGroupStudents++

    const report: string[] = []
    for (const by of AbsentGroupBy.options) {
      const folded = sortAbsentGroups(foldAbsentGroups(by, dimensions), null)

      const sum = folded.reduce((acc, row) => acc + row.count, 0)
      assert.equal(
        sum,
        rows.length,
        `${org.name}/${by}: сумма строк ${sum} ≠ ${rows.length} пропусков — пропуск попал не в одну корзину`,
      )
      assert.equal(
        folded.reduce((acc, row) => acc + row.unwarned, 0),
        unwarned,
        `${org.name}/${by}: непредупреждённые разъехались`,
      )
      assert.equal(
        folded.reduce((acc, row) => acc + row.lost, 0),
        lost,
        `${org.name}/${by}: потерянные деньги разъехались`,
      )
      assert.equal(
        folded.reduce((acc, row) => acc + row.saved, 0),
        saved,
        `${org.name}/${by}: спасённые деньги разъехались`,
      )

      const keys = new Set(folded.map((row) => row.key))
      assert.equal(keys.size, folded.length, `${org.name}/${by}: ключи строк не уникальны`)

      for (const row of folded) {
        assert.ok(row.label.length > 0, `${org.name}/${by}: строка без подписи`)
        assert.ok(
          row.unwarned <= row.count,
          `${org.name}/${by}/${row.label}: непредупреждённых больше, чем пропусков`,
        )
        assert.ok(
          row.students > 0 && row.students <= row.count,
          `${org.name}/${by}/${row.label}: учеников ${row.students} при ${row.count} пропусках`,
        )
        // Предупреждённый пропуск не списывается: строка целиком из таких стоит нуля.
        if (row.unwarned === 0) {
          assert.equal(
            row.lost,
            0,
            `${org.name}/${by}/${row.label}: деньги потеряны без единого непредупреждённого пропуска`,
          )
        }
        // И наоборот: спасать нечего там, где никто не предупреждал.
        if (row.unwarned === row.count) {
          assert.equal(
            row.saved,
            0,
            `${org.name}/${by}/${row.label}: деньги спасены без единого предупреждённого пропуска`,
          )
        }
      }

      // В разрезе «по ученику» строка — ровно один человек, поэтому колонки
      // «Учеников» там нет; проверка следит, что величина и правда вырождена.
      if (by === 'student') {
        for (const row of folded) {
          assert.equal(row.students, 1, `${org.name}/student/${row.label}: учеников не один`)
        }
      }

      // Ссылки проставлены каждая в своём разрезе — иначе строка вела бы в
      // произвольного из нескольких.
      const links = {
        student: folded.filter((row) => row.studentId !== null).length,
        group: folded.filter((row) => row.groupId !== null).length,
        teacher: folded.filter((row) => row.teachers !== null).length,
      }
      for (const [dimension, count] of Object.entries(links)) {
        assert.equal(
          count,
          by === dimension ? folded.length : 0,
          `${org.name}/${by}: ссылка «${dimension}» проставлена не по правилу`,
        )
      }

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
      `${org.name}: ${rows.length} пропусков (без предупреждения ${unwarned}, ` +
        `потеряно ${lost.toLocaleString('ru-RU')} ₽, спасено ${saved.toLocaleString('ru-RU')} ₽)` +
        ` → ${report.join(', ')}`,
    )
  }

  assert.ok(checkedOrgs > 0, 'ни в одной школе нет пропусков — сверять нечего')
  assert.ok(
    pairedTeacherRows > 0,
    'уроков с двумя преподавателями в выборке нет — равенство сумм по свёртке «teacher» ничего не доказывает',
  )
  assert.ok(
    multiGroupStudents > 0,
    'учеников с пропусками в нескольких группах нет — разница между «Пропусков» и «Учеников» ничего не доказывает',
  )
  assert.ok(
    orgsWithSaved > 0,
    'спасённых отработкой денег нигде нет — равенство по `saved` ничего не доказывает',
  )
  assert.ok(
    orgsWithMoney > 0,
    'потерянных денег нигде нет — равенство по `lost` ничего не доказывает',
  )

  console.log(
    `\nСводка пропусков сходится с плоским списком во всех разрезах ` +
      `(пропусков с парой преподавателей: ${pairedTeacherRows}).`,
  )
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
