/**
 * Самопроверка раздела «Напоминания» в кабинете родителя — настоящим кодом
 * против настоящей БД, внутри транзакции, которая в конце откатывается.
 *
 * Проверяется ядро (`cabinet.server.ts`), а не экшены: экшен из скрипта не
 * импортировать, `safe-action.ts` тянет `server-only`. Сами экшены — две
 * строки поверх этого ядра.
 *
 * Экраны проверяются здесь, а не в браузере: при скрытой панели предпросмотра
 * платформа не гидратируется и висит на скелетонах.
 *
 *   pnpm --filter platform exec tsx scripts/check-notifications-cabinet.ts
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import {
  disconnectCabinetMessenger,
  readCabinetMessengers,
} from '../src/features/notifications/cabinet.server'

class Rollback extends Error {}

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const stamp = Date.now()
      const org = await tx.organization.create({
        data: { name: `check-notify-${stamp}`, slug: `check-notify-${stamp}` },
        select: { id: true },
      })

      const parent = await tx.parent.create({
        data: { firstName: 'Проверка', phone: '+7 (999) 000-00-01', organizationId: org.id },
        select: { id: true, accessToken: true },
      })
      const token = parent.accessToken
      const read = () => readCabinetMessengers(tx, token)

      // ─── Ничего не подключено ────────────────────────────────────────
      assert.deepEqual(
        await read(),
        { vk: false, max: false, hasPhone: true },
        'у нового родителя не подключено ничего, но номер есть',
      )

      // ─── Подключение видно ───────────────────────────────────────────
      await tx.parentMessenger.create({
        data: {
          provider: 'VK',
          externalId: `check-cabinet-${stamp}`,
          parentId: parent.id,
          organizationId: org.id,
        },
      })
      assert.equal((await read())?.vk, true, 'привязка VK видна в кабинете')
      assert.equal((await read())?.max, false, 'MAX при этом не подключён')

      // ─── Отключение ──────────────────────────────────────────────────
      assert.equal(
        await disconnectCabinetMessenger(tx, token, 'VK'),
        1,
        'отключилась одна привязка',
      )
      assert.equal((await read())?.vk, false, 'после отключения канал погашен')
      assert.equal(
        await disconnectCabinetMessenger(tx, token, 'VK'),
        0,
        'повторное отключение ничего не трогает',
      )

      // Строка осталась: она и есть ответ на «почему мне перестало приходить».
      assert.equal(
        await tx.parentMessenger.count({ where: { parentId: parent.id } }),
        1,
        'отписка не удаляет привязку',
      )

      // ─── Родитель без телефона ───────────────────────────────────────
      const noPhone = await tx.parent.create({
        data: { firstName: 'Без номера', organizationId: org.id },
        select: { accessToken: true },
      })
      assert.equal(
        (await readCabinetMessengers(tx, noPhone.accessToken))?.hasPhone,
        false,
        'без номера подключение по телефону не предлагается',
      )

      // ─── Школа выключила фичу ────────────────────────────────────────
      await tx.organizationFeature.create({
        data: { organizationId: org.id, featureKey: 'notifications', enabled: false },
      })
      assert.equal(await read(), null, 'выключенная фича прячет раздел целиком')

      // ─── Чужой токен ─────────────────────────────────────────────────
      await assert.rejects(
        () => readCabinetMessengers(tx, '11111111-2222-3333-4444-555555555555'),
        'несуществующий токен — отказ, а не пустой раздел',
      )

      throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  const leftovers = await prisma.parentMessenger.count({
    where: { externalId: { startsWith: 'check-cabinet-' } },
  })
  assert.equal(leftovers, 0, 'транзакция откатилась, декораций не осталось')

  console.log('check-notifications-cabinet: всё сошлось')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
