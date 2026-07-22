/**
 * Одноразовый backfill: из plaintext `StudentAccount.password` заводит
 * better-auth-учётку ученика (`StudentUser` + `StudentCredential`) и обратимую
 * копию пароля (`StudentAccount.passwordEnc`).
 *
 * Запускать МЕЖДУ миграциями `student_auth` и `drop_student_password` — вторая
 * удаляет колонку `password` и падает, если backfill не отработал.
 *
 *   pnpm --filter platform exec tsx scripts/backfill-student-auth.ts
 *
 * Идемпотентен: аккаунты, у которых уже есть `studentUserId`, пропускаются.
 */
import { prisma } from '@repo/db'
import { createStudentUserTx } from '../src/lib/student-auth'
import { decryptStudentPassword } from '../src/lib/student-password'

// Колонка `password` в схеме уже отсутствует (её удаляет вторая миграция),
// поэтому plaintext читается сырым SQL.
type Row = { id: number; login: string; password: string; studentId: number }

async function main() {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, login, password, "studentId"
    FROM "StudentAccount"
    WHERE "studentUserId" IS NULL
    ORDER BY id
  `

  if (rows.length === 0) {
    console.info('backfill-student-auth: нечего переносить')
    return
  }

  const students = await prisma.student.findMany({
    where: { id: { in: rows.map((r) => r.studentId) } },
    select: { id: true, firstName: true, lastName: true },
  })
  const nameById = new Map(students.map((s) => [s.id, `${s.lastName} ${s.firstName}`]))

  let done = 0
  for (const row of rows) {
    await prisma.$transaction(async (tx) => {
      const { studentUserId, passwordEnc } = await createStudentUserTx(tx, {
        login: row.login,
        password: row.password,
        name: nameById.get(row.studentId) ?? row.login,
      })
      // Обратимость проверяется на живых данных: после этого скрипта plaintext
      // удаляется второй миграцией, и молча испорченный шифр уже не поймать.
      if (decryptStudentPassword(passwordEnc) !== row.password) {
        throw new Error(
          `StudentAccount ${row.id}: шифротекст не расшифровывается в исходный пароль`,
        )
      }
      await tx.studentAccount.update({
        where: { id: row.id },
        data: { studentUserId, passwordEnc },
      })
    })
    done++
  }

  console.info(`backfill-student-auth: перенесено аккаунтов — ${done}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
