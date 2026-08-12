import type { Prisma } from '@repo/db'
import type { StudentStatus } from '@repo/db/enums'

/**
 * Закрытие группы со стороны учеников.
 *
 * Группа закрывается двумя путями — «завершить» и «архивировать», — и оба
 * обязаны закрыть записи `StudentGroup`. Пока это была копипаста в двух
 * экшенах, архивация про неё забыла: ученики остались ACTIVE в несуществующей
 * группе и продолжали считаться действующими во всех фильтрах и метриках.
 * Теперь путь один, и забыть его нельзя.
 *
 * Живёт отдельно от `actions.ts` по двум причинам: тот файл помечен
 * `'use server'` и не может экспортировать ничего, кроме экшенов, а
 * `scripts/check-archive-group.ts` вызывает эту функцию напрямую, без сессии.
 */
export async function closeStudentGroupsTx(
  tx: Prisma.TransactionClient,
  args: {
    groupId: number
    /** Календарный день закрытия (`YYYY-MM-DD`) — дата архивации или завершения. */
    statusChangedAt: string
    /**
     * COMPLETED — курс пройден: попадает в «Выпускники» и в достижение
     * «Выпускник» (150 коинов в кабинете ученика).
     * ARCHIVED — группу свернули: ученик не отчислялся и курс не проходил,
     * поэтому ни в отток, ни в выпускники такая запись не идёт.
     */
    status: Extract<StudentStatus, 'COMPLETED' | 'ARCHIVED'>
  },
) {
  // Только живые записи: отчисленных и переведённых задним числом не переписываем.
  return await tx.studentGroup.updateMany({
    where: { groupId: args.groupId, status: { in: ['ACTIVE', 'TRIAL'] } },
    data: {
      status: args.status,
      statusChangedAt: args.statusChangedAt,
      statusComment: null,
    },
  })
}
