import type { Prisma } from '@repo/db'
import {
  StudentFinancialField,
  StudentLessonsBalanceChangeReason,
  WalletEntryKind,
} from '@repo/db/enums'
// Относительные пути, а не алиасы: этот модуль запускают скрипты через tsx.
import {
  recordWalletEntryTx,
  settleUnpaidAttendancesTx,
  writeFinancialHistoryTx,
} from './ledger.server'
import { ConflictError, NotFoundError } from '../../lib/error'

/**
 * Перенос пакета на другой кошелёк того же ученика.
 *
 * Второе место после `ledger.server.ts`, которое двигает `wallet.lessonsBalance`.
 * Живёт отдельно, потому что занимается другим: тот превращает занятие в деньги,
 * этот меняет пакету владельца.
 *
 * Переносится **пакет целиком, а не уроки**: урок несёт цену своего пакета, и она
 * замерзает в проводке при списании. «Перенести пять уроков» нечем оценить, а
 * назначить баланс руками по-прежнему нельзя.
 *
 * Что именно едет, задаёт одно правило: **переносим ровно то, что кошелёк сейчас
 * держит от этого пакета.** Баланс — на остаток, счётчики — на размер и цену
 * (списания их не уменьшали). У неоплаченного пакета кошелёк не держит ничего,
 * поэтому у него меняется только владелец: ни журнала, ни баланса.
 *
 * Уже списанные занятия не трогаются. Их цена заморожена, а откат сам уведёт урок
 * к новому владельцу пакета (`unchargeAttendanceTx`) — следствия этого расписаны в
 * шапке `ledger.server.ts`.
 *
 * Группы здесь не перепривязываются. Если после переноса у источника остаются
 * живые группы без пакетов, их занятия будут ждать оплаты — об этом предупреждает
 * интерфейс, а перевесить группу можно вручную (`linkGroupToWallet`).
 */

/** Что нужно знать о пакете, чтобы его перенести. */
const packageSelect = {
  id: true,
  status: true,
  walletId: true,
  studentId: true,
  organizationId: true,
  remaining: true,
  lessonCount: true,
  price: true,
  unitPrice: true,
  date: true,
  productName: true,
} satisfies Prisma.PackageSelect

const walletSelect = {
  id: true,
  name: true,
  status: true,
  studentId: true,
  lessonsBalance: true,
  totalLessons: true,
  totalPayments: true,
} satisfies Prisma.WalletSelect

type TransferWallet = Prisma.WalletGetPayload<{ select: typeof walletSelect }>

const walletLabel = (wallet: TransferWallet) => wallet.name || `Кошелёк #${wallet.id}`

const readWalletTx = (tx: Prisma.TransactionClient, id: number, organizationId: number) =>
  tx.wallet.findFirst({ where: { id, organizationId }, select: walletSelect })

/**
 * Один пакет меняет кошелёк.
 *
 * Гашение и запись в историю сюда не входят намеренно: и то и другое делается один
 * раз на всю операцию (см. `transferPackagesTx`).
 *
 * Возвращает, сколько уроков уехало: остаток у оплаченного пакета, ноль у
 * неоплаченного.
 */
export async function movePackageTx(
  tx: Prisma.TransactionClient,
  args: {
    packageId: number
    toWalletId: number
    organizationId: number
    actorUserId: number | null
    /** День переноса, а не день продажи: это новое событие. */
    effectiveAt: string
  },
): Promise<{ moved: number }> {
  const packet = await tx.package.findFirst({
    where: { id: args.packageId, organizationId: args.organizationId },
    select: packageSelect,
  })
  if (!packet) throw new NotFoundError('Пакет не найден')

  if (packet.walletId === args.toWalletId) {
    throw new ConflictError('Пакет уже на этом кошельке')
  }
  // Отменённый переносить нечего и незачем: остаток снят, счётчики кошелька отмена
  // уже уменьшила, и перенос вычел бы их второй раз.
  if (packet.status === 'CANCELLED') {
    throw new ConflictError('Отменённый пакет перенести нельзя')
  }

  const source = await readWalletTx(tx, packet.walletId, args.organizationId)
  const target = await readWalletTx(tx, args.toWalletId, args.organizationId)
  if (!source) throw new NotFoundError('Исходный кошелёк не найден')
  if (!target) throw new NotFoundError('Кошелёк-получатель не найден')

  // Между учениками не переносим: списанные с пакета занятия принадлежат конкретному
  // ученику, и переезд переписал бы чужую историю. Ошибка «деньги ушли не тому
  // ребёнку» чинится отменой пакета и новой оплатой.
  if (target.studentId !== packet.studentId) {
    throw new ConflictError('Кошелёк принадлежит другому ученику')
  }
  // Архивный источник разрешён намеренно: иначе остаток, запертый в нём архивацией,
  // не достать ничем — вернуть кошелёк из архива нельзя.
  if (target.status !== 'ACTIVE') {
    throw new ConflictError('Кошелёк-получатель архивирован')
  }

  // Условный апдейт вместо простого: если кто-то успел перенести или отменить этот
  // пакет раньше нас, `count` будет нулём и мы не станем двигать деньги по
  // устаревшему снимку.
  const claimed = await tx.package.updateMany({
    where: { id: packet.id, walletId: packet.walletId, status: packet.status },
    data: { walletId: args.toWalletId },
  })
  if (claimed.count !== 1) {
    throw new ConflictError('Пакет изменился, пока шёл перенос — обновите страницу')
  }

  // Остаток перечитываем после захвата: прочитанный до него мог устареть от
  // параллельного списания, а условие апдейта за остатком не следит.
  const fresh = await tx.package.findUniqueOrThrow({
    where: { id: packet.id },
    select: { status: true, remaining: true },
  })

  // Неоплаченный пакет уроков не выдавал: `activatePackageTx` по нему не отрабатывал,
  // в журнале его нет и баланса он не двигал. Значит переносить нечего — меняется
  // только владелец. Строку журнала здесь писать нельзя: `check-package-statuses.ts`
  // требует, чтобы у пакета `PENDING` их не было ни одной.
  if (fresh.status !== 'ACTIVE') return { moved: 0 }

  const moved = fresh.remaining

  // Пара строк журнала: минус на источнике, плюс на получателе. Обе несут `packageId`,
  // поэтому сумма по пакету не меняется, а суммы по кошелькам едут верно.
  // `attendanceId` пустой — сверка выручки считает только строки занятий.
  for (const [wallet, quantity, comment] of [
    [source, -moved, `Перенос пакета в кошелёк «${walletLabel(target)}»`],
    [target, moved, `Перенос пакета из кошелька «${walletLabel(source)}»`],
  ] as const) {
    await recordWalletEntryTx(tx, {
      organizationId: args.organizationId,
      walletId: wallet.id,
      studentId: packet.studentId,
      kind: WalletEntryKind.TRANSFER,
      quantity,
      unitPrice: packet.unitPrice,
      effectiveAt: args.effectiveAt,
      packageId: packet.id,
      actorUserId: args.actorUserId,
      comment,
    })
  }

  // Баланс двигается точно на остаток — этого требует `check-wallet-balance.ts`.
  //
  // `totalLessons` и `totalPayments` таким инвариантом не защищены: бэкфиллы перехода
  // заводили пакеты, не трогая счётчики («Счётчик остаётся как есть»), поэтому сумма
  // по пакетам может обгонять счётчик. Вычитаем через `min`, иначе счётчик уходит в
  // минус, а на минусе карточка кошелька делит на него для полосы прогресса. Сумма по
  // ученику при обрезке сохраняется: и таблица учеников, и кабинет родителя считают
  // по всем кошелькам сразу.
  // Снизу зажимаем нулём: у счётчика, уже ушедшего в минус, `min` дал бы отрицательное
  // число, и вычитание превратилось бы в прибавление.
  const lessons = Math.max(0, Math.min(packet.lessonCount, source.totalLessons))
  const payments = Math.max(0, Math.min(packet.price, source.totalPayments))

  await tx.wallet.update({
    where: { id: source.id },
    data: {
      lessonsBalance: { decrement: moved },
      totalLessons: { decrement: lessons },
      totalPayments: { decrement: payments },
    },
  })
  await tx.wallet.update({
    where: { id: target.id },
    data: {
      lessonsBalance: { increment: moved },
      totalLessons: { increment: lessons },
      totalPayments: { increment: payments },
    },
  })

  return { moved }
}

/**
 * Операция целиком: несколько пакетов одного кошелька уезжают на другой.
 *
 * Гашение и запись в историю — по одному разу на всю операцию, а не на каждый пакет.
 * Гашение по частичному балансу закрыло бы меньше занятий, чем закрывает итоговый, а
 * история из трёх пакетов дала бы восемнадцать строк с прыгающими «было/стало» двух
 * разных кошельков.
 */
export async function transferPackagesTx(
  tx: Prisma.TransactionClient,
  args: {
    packageIds: number[]
    toWalletId: number
    organizationId: number
    actorUserId: number | null
    effectiveAt: string
  },
): Promise<{ packages: number; moved: number; settled: number }> {
  if (args.packageIds.length === 0) throw new ConflictError('Не выбрано ни одного пакета')

  const packages = await tx.package.findMany({
    where: { id: { in: args.packageIds }, organizationId: args.organizationId },
    select: { id: true, walletId: true, date: true, productName: true },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  })
  if (packages.length !== args.packageIds.length) {
    throw new NotFoundError('Пакет не найден')
  }

  // Все с одного кошелька: иначе «состояние источника до» — это состояние нескольких
  // кошельков, и одной сводной записью в историю их не описать.
  const fromWalletId = packages[0]!.walletId
  if (packages.some((p) => p.walletId !== fromWalletId)) {
    throw new ConflictError('Пакеты лежат на разных кошельках')
  }

  const before = await readWalletTx(tx, fromWalletId, args.organizationId)
  const targetBefore = await readWalletTx(tx, args.toWalletId, args.organizationId)
  if (!before) throw new NotFoundError('Исходный кошелёк не найден')
  if (!targetBefore) throw new NotFoundError('Кошелёк-получатель не найден')

  let moved = 0
  for (const packet of packages) {
    const result = await movePackageTx(tx, {
      packageId: packet.id,
      toWalletId: args.toWalletId,
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      effectiveAt: args.effectiveAt,
    })
    moved += result.moved
  }

  const source = await readWalletTx(tx, fromWalletId, args.organizationId)
  const target = await readWalletTx(tx, args.toWalletId, args.organizationId)
  if (!source || !target) throw new NotFoundError('Кошелёк не найден')

  // Названия кошельков — снимком: их могут переименовать, а подпись в истории обязана
  // остаться прежней. Та же логика, что у `Package.productName`. Название продукта —
  // только когда пакет один: у нескольких общего названия нет.
  const meta = {
    packageIds: packages.map((p) => p.id),
    count: packages.length,
    fromWalletId: source.id,
    toWalletId: target.id,
    fromWalletName: walletLabel(before),
    toWalletName: walletLabel(targetBefore),
    productName: packages.length === 1 ? packages[0]!.productName || undefined : undefined,
  }

  // История пишется до гашения, а не после: гашение двигает баланс получателя и
  // пишет свои строки. Сводка, снятая до него, но записанная после, показала бы
  // «стало», которое к тому моменту уже неверно, и разошлась бы со строками гашения.
  for (const [wallet, was] of [
    [source, before],
    [target, targetBefore],
  ] as const) {
    for (const [field, key] of [
      [StudentFinancialField.LESSONS_BALANCE, 'lessonsBalance'],
      [StudentFinancialField.TOTAL_PAYMENTS, 'totalPayments'],
      [StudentFinancialField.TOTAL_LESSONS, 'totalLessons'],
    ] as const) {
      await writeFinancialHistoryTx(tx, {
        organizationId: args.organizationId,
        studentId: wallet.studentId,
        actorUserId: args.actorUserId,
        walletId: wallet.id,
        field,
        reason: StudentLessonsBalanceChangeReason.WALLET_TRANSFER,
        delta: wallet[key] - was[key],
        balanceBefore: was[key],
        balanceAfter: wallet[key],
        meta,
      })
    }
  }

  // Гасим по балансу получателя, а не по перенесённому: у него мог быть свой остаток,
  // а больше, чем кошелёк держит, всё равно не спишется. Функция сама выходит на
  // первом несписавшемся занятии, так что запросить с запасом бесплатно.
  const settled = await settleUnpaidAttendancesTx(tx, {
    walletId: target.id,
    organizationId: args.organizationId,
    take: target.lessonsBalance,
    actorUserId: args.actorUserId,
    meta: { settledByTransferOf: packages.map((p) => p.id) },
  })

  return { packages: packages.length, moved, settled }
}
