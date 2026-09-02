/**
 * Самопроверка привязки родителя — настоящим кодом против настоящей БД.
 *
 * Всё внутри одной транзакции, которая в конце откатывается: временные школа,
 * родитель и привязки в базе не остаются. Мока Prisma нет намеренно — половина
 * проверяемого здесь и есть поведение самой базы: уникальный индекс, тип `uuid`
 * у токена, `updateMany` по несуществующим строкам.
 *
 *   pnpm --filter bots check:bind
 *
 * Через скрипт пакета, а не `exec`: у `pnpm --filter … exec` рабочий каталог
 * остаётся корнем репо, и `--env-file=.env` там не находит файла.
 */
import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import { bindByRef, isStopCommand, resubscribeAll, unsubscribeAll } from '../src/bind'

class Rollback extends Error {}

/** Аккаунт «в мессенджере» — лишь бы не пересекался с настоящими. */
const VK_USER = '999000111'

async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true } })
  if (!org) throw new Error('В базе нет ни одной организации — проверять не на чем')

  try {
    await prisma.$transaction(async (tx) => {
      const parent = await tx.parent.create({
        data: { firstName: 'Проверка', lastName: 'Привязки', organizationId: org.id },
        select: { id: true, accessToken: true },
      })

      const count = () =>
        tx.parentMessenger.count({ where: { provider: 'VK', externalId: VK_USER } })

      // ─── Мусор вместо токена не должен доходить до драйвера ────────────
      // Колонка `uuid`: Postgres падает на любой строке не той формы, а строка
      // приходит из ссылки, то есть от кого угодно.
      assert.equal(await bindByRef(tx, 'не-uuid-вовсе', VK_USER), null, 'мусорный ref')
      assert.equal(await bindByRef(tx, '', VK_USER), null, 'пустой ref')
      assert.equal(
        await bindByRef(tx, '11111111-2222-3333-4444-555555555555', VK_USER),
        null,
        'чужой uuid',
      )
      assert.equal(await count(), 0, 'на отказах привязок не заводится')

      // ─── Привязка по своей ссылке ──────────────────────────────────────
      const bound = await bindByRef(tx, parent.accessToken, VK_USER)
      assert.equal(bound?.parentId, parent.id, 'привязка нашла родителя')
      assert.equal(bound?.firstName, 'Проверка', 'имя для ответа в чат')
      assert.equal(await count(), 1, 'ровно одна привязка')

      // Повторный переход по той же ссылке — не вторая строка и не ошибка.
      await bindByRef(tx, parent.accessToken, VK_USER)
      assert.equal(await count(), 1, 'повтор не задваивает привязку')

      // ─── Отписка ───────────────────────────────────────────────────────
      assert.equal(await unsubscribeAll(tx, 'VK', VK_USER), 1, 'отписалась одна привязка')
      assert.equal(await count(), 1, 'отписка не удаляет строку')
      assert.equal(
        await unsubscribeAll(tx, 'VK', VK_USER),
        0,
        'повторная отписка ничего не трогает',
      )

      // ─── Возврат ───────────────────────────────────────────────────────
      // И через `message_allow`, и через повторный переход по ссылке.
      assert.equal(await resubscribeAll(tx, 'VK', VK_USER), 1, 'message_allow вернул подписку')
      assert.equal(await resubscribeAll(tx, 'VK', VK_USER), 0, 'вернуть уже активную нечего')

      await unsubscribeAll(tx, 'VK', VK_USER)
      await bindByRef(tx, parent.accessToken, VK_USER)
      const revived = await tx.parentMessenger.findFirstOrThrow({
        where: { provider: 'VK', externalId: VK_USER },
        select: { unsubscribedAt: true, organizationId: true },
      })
      assert.equal(revived.unsubscribedAt, null, 'переход по ссылке включает обратно')
      assert.equal(revived.organizationId, org.id, 'школа взята у родителя')

      // ─── Чужой аккаунт не задет ────────────────────────────────────────
      assert.equal(await unsubscribeAll(tx, 'VK', '111'), 0, 'чужой externalId не затронут')
      assert.equal(await unsubscribeAll(tx, 'MAX', VK_USER), 0, 'другой мессенджер не затронут')

      throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  // ─── Команды отписки, как их напишет человек ─────────────────────────
  for (const text of ['/stop', 'СТОП', ' отписаться ', 'Stop']) {
    assert.ok(isStopCommand(text), `«${text}» — команда отписки`)
  }
  for (const text of ['стоп-урок', 'а как отписаться?', '']) {
    assert.ok(!isStopCommand(text), `«${text}» — не команда`)
  }

  // Транзакция откатилась — в базе не должно остаться ничего.
  const leftovers = await prisma.parentMessenger.count({ where: { externalId: VK_USER } })
  assert.equal(leftovers, 0, 'транзакция откатилась, привязок не осталось')

  console.log('check-bind: всё сошлось')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
