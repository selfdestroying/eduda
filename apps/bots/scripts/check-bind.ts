/**
 * Самопроверка привязки родителя — настоящим кодом против настоящей БД.
 *
 * Всё внутри одной транзакции, которая в конце откатывается: временные школы,
 * родители и привязки в базе не остаются. Мока Prisma нет намеренно — половина
 * проверяемого здесь и есть поведение самой базы: уникальный индекс и
 * `updateMany` по несуществующим строкам.
 *
 *   pnpm --filter bots check:bind
 *
 * Через скрипт пакета, а не `exec`: у `pnpm --filter … exec` рабочий каталог
 * остаётся корнем репо, и `--env-file=.env` там не находит файла.
 */
import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import { bindByPhone, readBindings, readCommand, resubscribeAll, unsubscribeAll } from '../src/bind'
import type { BotScope } from '../src/bots'
import { todayYmdInTz } from '@repo/core/timezone'
import { normalizePhone, phoneFromVCard } from '../src/phone'
import { toggledText } from '../src/routes/max'
import { buildBindSummary } from '../src/summary'

class Rollback extends Error {}

/** Аккаунт «в мессенджере» — лишь бы не пересекался с настоящими. */
const MAX_USER = '999000222'

/** Бот ЕДУДА. Область бота школы заводится ниже, вместе со школой. */
const EDUDA: BotScope = { ownBot: false }

const names = (parents: { firstName: string }[]) => parents.map((parent) => parent.firstName).sort()

async function main() {
  const org = await prisma.organization.findFirst({
    select: { id: true, name: true, timezone: true },
  })
  if (!org) throw new Error('В базе нет ни одной организации — проверять не на чем')

  // Календарный день школы: им датируются группа и запись ученика в неё.
  const today = todayYmdInTz(org.timezone)

  try {
    await prisma.$transaction(async (tx) => {
      const stamp = Date.now()

      // ─── Привязка по телефону ──────────────────────────────────────────
      // Один номер записан по-разному и в двух школах: у человека дети в обеих,
      // и оба ребёнка обязаны получить напоминания.
      const otherOrg = await tx.organization.create({
        data: { name: `check-bind-${stamp}`, slug: `check-bind-${stamp}` },
        select: { id: true, name: true },
      })
      await tx.parent.create({
        data: { firstName: 'Первый', phone: '+7 (999) 123-45-67', organizationId: org.id },
      })
      await tx.parent.create({
        data: { firstName: 'Второй', phone: '89991234567', organizationId: otherOrg.id },
      })
      await tx.parent.create({
        data: { firstName: 'Посторонний', phone: '79990000000', organizationId: org.id },
      })

      const byPhone = await bindByPhone(tx, EDUDA, MAX_USER, '79991234567')
      assert.deepEqual(
        names(byPhone),
        ['Второй', 'Первый'],
        'один номер — оба родителя в разных школах, записанный по-разному номер совпал',
      )

      const rows = await tx.parentMessenger.findMany({
        where: { provider: 'MAX', externalId: MAX_USER },
        select: { organizationId: true, phone: true, ownBot: true },
      })
      assert.equal(rows.length, 2, 'по привязке на каждого родителя')
      assert.deepEqual(
        rows.map((row) => row.organizationId).sort(),
        [org.id, otherOrg.id].sort(),
        'школы взяты у родителей',
      )
      assert.ok(
        rows.every((row) => row.phone === '79991234567'),
        'номер сохранён нормализованным',
      )
      assert.ok(
        rows.every((row) => !row.ownBot),
        'привязка через бот ЕДУДА',
      )

      // Повтор не задваивает, а отписанного возвращает.
      await unsubscribeAll(tx, EDUDA, MAX_USER)
      const again = await bindByPhone(tx, EDUDA, MAX_USER, '79991234567')
      assert.equal(again.length, 2, 'повтор нашёл тех же')
      const revivedMax = await tx.parentMessenger.count({
        where: { provider: 'MAX', externalId: MAX_USER, unsubscribedAt: null },
      })
      assert.equal(revivedMax, 2, 'повторная отправка номера включает обратно')

      assert.equal(
        (await bindByPhone(tx, EDUDA, MAX_USER, '79995555555')).length,
        0,
        'чужой номер никого не привязывает',
      )

      // ─── Свой бот школы ────────────────────────────────────────────────
      const ownOrg = await tx.organization.create({
        data: { name: `check-bind-own-${stamp}`, slug: `check-bind-own-${stamp}` },
        select: { id: true, name: true },
      })
      const third = await tx.parent.create({
        data: { firstName: 'Третий', phone: '8 (999) 123-45-67', organizationId: ownOrg.id },
        select: { id: true },
      })

      assert.deepEqual(
        names(await bindByPhone(tx, EDUDA, MAX_USER, '79991234567')),
        ['Второй', 'Первый', 'Третий'],
        'пока своего бота у школы нет, её родителей привязывает бот ЕДУДА',
      )

      await tx.organizationMaxBot.create({
        data: { organizationId: ownOrg.id, tokenEnc: new Uint8Array([1]), username: 'check_bot' },
      })
      const SCHOOL: BotScope = { ownBot: true, organizationId: ownOrg.id }

      assert.deepEqual(
        names(await bindByPhone(tx, EDUDA, MAX_USER, '79991234567')),
        ['Второй', 'Первый'],
        'школа со своим ботом боту ЕДУДА не видна: он пообещал бы напоминания, которые пойдут другим ботом',
      )
      assert.deepEqual(
        names(await bindByPhone(tx, SCHOOL, MAX_USER, '79991234567')),
        ['Третий'],
        'бот школы видит только её родителей: через него уходят ссылки на кабинеты',
      )
      assert.equal(
        await tx.parentMessenger.count({ where: { parentId: third.id, externalId: MAX_USER } }),
        2,
        'один аккаунт у одного родителя в двух ботах — две строки, без конфликта ключа',
      )

      // ─── Отписка и возврат ─────────────────────────────────────────────
      // Отписка — по аккаунту: «стоп» пишет человек и имеет в виду «мне», а не
      // «этому ребёнку». Но только в том боте, где её написали.
      assert.equal(
        await unsubscribeAll(tx, SCHOOL, MAX_USER),
        1,
        '/stop в боте школы гасит только привязку к нему',
      )
      assert.equal(
        await tx.parentMessenger.count({
          where: { externalId: MAX_USER, ownBot: false, unsubscribedAt: null },
        }),
        3,
        'привязки бота ЕДУДА при этом не тронуты',
      )
      assert.equal(
        await unsubscribeAll(tx, EDUDA, MAX_USER),
        3,
        'отписались все привязки аккаунта к боту ЕДУДА',
      )
      assert.equal(
        await unsubscribeAll(tx, EDUDA, MAX_USER),
        0,
        'повторная отписка ничего не трогает',
      )
      assert.equal(
        await tx.parentMessenger.count({ where: { externalId: MAX_USER } }),
        4,
        'отписка не удаляет строки',
      )
      assert.equal(
        await resubscribeAll(tx, EDUDA, MAX_USER),
        3,
        '/resume вернул привязки бота ЕДУДА',
      )
      assert.equal(
        await tx.parentMessenger.count({
          where: { externalId: MAX_USER, ownBot: true, unsubscribedAt: null },
        }),
        0,
        'а привязку к боту школы — нет',
      )
      assert.equal(
        await resubscribeAll(tx, SCHOOL, MAX_USER),
        1,
        '/resume в боте школы вернул привязку к нему',
      )
      assert.equal(await resubscribeAll(tx, EDUDA, MAX_USER), 0, 'вернуть уже активные нечего')
      assert.equal(await unsubscribeAll(tx, EDUDA, '111'), 0, 'чужой аккаунт не затронут')

      // ─── Что этот аккаунт вообще привязал ──────────────────────────────
      // Ответ бота на команду зависит от трёх состояний, а не двух: привязок
      // нет вовсе, они есть и включены, они есть и отключены.
      const bindings = await readBindings(tx, EDUDA, MAX_USER)
      assert.equal(bindings.length, 3, 'бот ЕДУДА видит свои привязки одним списком')
      assert.ok(
        bindings.every((binding) => binding.active),
        'после возврата все включены',
      )
      assert.deepEqual(
        bindings.map((binding) => binding.organization).sort(),
        [org.name, otherOrg.name, ownOrg.name].sort(),
        'у каждой ссылки на кабинет своя школа',
      )
      assert.deepEqual(
        (await readBindings(tx, SCHOOL, MAX_USER)).map((binding) => binding.organization),
        [ownOrg.name],
        'бот школы видит только привязки к нему',
      )
      assert.equal(
        (await readBindings(tx, EDUDA, '999000333')).length,
        0,
        'у чужого аккаунта привязок нет — ему покажут приветствие',
      )

      // ─── Рассказ о детях ───────────────────────────────────────────────
      const first = byPhone.find((parent) => parent.firstName === 'Первый')!
      const firstToken = bindings.find((binding) => binding.firstName === 'Первый')!.accessToken
      const course = await tx.course.create({
        data: { name: 'Python-разработка', organizationId: org.id },
        select: { id: true },
      })
      const location = await tx.location.create({
        data: { name: 'Ленина, 5', organizationId: org.id },
        select: { id: true },
      })
      const group = await tx.group.create({
        data: {
          organizationId: org.id,
          courseId: course.id,
          locationId: location.id,
          startDate: today,
          maxStudents: 10,
          schedules: {
            create: [
              { organizationId: org.id, dayOfWeek: 3, time: '17:00' },
              { organizationId: org.id, dayOfWeek: 1, time: '17:00' },
            ],
          },
        },
        select: { id: true },
      })
      const student = await tx.student.create({
        data: { firstName: 'Иван', lastName: 'Петров', organizationId: org.id },
        select: { id: true },
      })
      await tx.studentParent.create({
        data: { organizationId: org.id, studentId: student.id, parentId: first.parentId },
      })
      const wallet = await tx.wallet.create({
        data: { organizationId: org.id, studentId: student.id, lessonsBalance: 8 },
        select: { id: true },
      })
      await tx.studentGroup.create({
        data: {
          organizationId: org.id,
          studentId: student.id,
          groupId: group.id,
          walletId: wallet.id,
          status: 'ACTIVE',
          statusChangedAt: today,
        },
      })
      const summary = await buildBindSummary(tx, [first.parentId])
      for (const fragment of [
        'Готово, Первый',
        org.name,
        'Иван Петров',
        'Python-разработка',
        'Ленина, 5',
        // Понедельник впереди среды, хотя в базе среда заведена первой.
        'пн, ср в 17:00',
        'Осталось занятий: 8',
        'parent.',
      ]) {
        assert.ok(summary.includes(fragment), `в рассказе о детях есть «${fragment}»`)
      }
      // Домен приходит из `PLATFORM_URL` и на стенде другой — проверяем то, что
      // от него не зависит: поддомен кабинета (выше) и токен родителя в пути.
      assert.ok(summary.includes(`/${firstToken}`), 'ссылка на кабинет собрана по токену родителя')

      // Отчисленного в рассказе быть не должно: он в группе числится, но
      // занятий у него нет.
      await tx.studentGroup.update({
        where: { studentId_groupId: { studentId: student.id, groupId: group.id } },
        data: { status: 'DISMISSED' },
      })
      const afterDismiss = await buildBindSummary(tx, [first.parentId])
      assert.ok(
        !afterDismiss.includes('Python-разработка'),
        'отчисленная запись в рассказ не попадает',
      )
      assert.ok(
        afterDismiss.includes('Пока нет активных групп'),
        'ребёнок без групп назван прямо, а не пропущен молча',
      )

      throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  // ─── Телефон: в базе он записан как попало ───────────────────────────
  for (const raw of ['+7 (999) 123-45-67', '89991234567', '79991234567', '9991234567']) {
    assert.equal(normalizePhone(raw), '79991234567', `«${raw}» приводится к одному виду`)
  }
  for (const raw of ['', '123', 'не телефон', '+1 202 555 0143']) {
    assert.equal(normalizePhone(raw), null, `«${raw}» — не российский номер`)
  }

  // vCard из вложения `contact`: строка TEL бывает с параметрами.
  assert.equal(
    phoneFromVCard('BEGIN:VCARD\r\nFN:Мама\r\nTEL;TYPE=CELL:+7 999 123-45-67\r\nEND:VCARD'),
    '79991234567',
    'номер вынут из vCard с параметрами',
  )
  assert.equal(
    phoneFromVCard('BEGIN:VCARD\nTEL:89991234567\nEND:VCARD'),
    '79991234567',
    'номер вынут из vCard без параметров',
  )
  assert.equal(phoneFromVCard('BEGIN:VCARD\nFN:Без телефона\nEND:VCARD'), null, 'vCard без TEL')

  // ─── Кнопка под напоминанием ─────────────────────────────────────────
  // Нажатие правит то же сообщение, поэтому приписка о состоянии обязана
  // заменяться, а не накапливаться: иначе после пяти нажатий под напоминанием
  // висит пять строк.
  const OFF = '🔕 Напоминания отключены. Вернуть — кнопкой ниже.'
  const ON = '🔔 Напоминания снова приходят.'
  const reminder = ['Сегодня, 6 сентября', '', '• Артём — Python, 18:00, Онлайн'].join('\n')
  const withNote = (note: string) => [reminder, '', note].join('\n')

  const off = toggledText(reminder, OFF)
  assert.equal(off, withNote(OFF), 'приписка встала под текстом школы')

  const back = toggledText(off, ON)
  assert.equal(back, withNote(ON), 'вторая приписка заменила первую')
  assert.equal(toggledText(back, OFF), off, 'и обратно — текст тот же, что был')

  // Пять нажатий подряд — по-прежнему одна строка хвоста.
  let text = reminder
  for (let i = 0; i < 5; i += 1) text = toggledText(text, i % 2 === 0 ? OFF : ON)
  assert.equal(text, withNote(OFF), 'хвост не копится')

  // Шаблон школы трогать нельзя, даже если она сама пишет про колокольчики.
  const tricky = 'Занятие завтра 🔔 не забудьте'
  assert.equal(toggledText(tricky, OFF), [tricky, '', OFF].join('\n'), 'текст школы не обрезан')

  // ─── Команды, как их напишет человек ─────────────────────────────────
  for (const [text, command] of [
    ['/stop', 'stop'],
    ['СТОП', 'stop'],
    [' отписаться ', 'stop'],
    ['Stop', 'stop'],
    ['/resume', 'resume'],
    ['включить', 'resume'],
    ['/cabinet', 'cabinet'],
    ['Кабинет', 'cabinet'],
  ] as const) {
    assert.equal(readCommand(text), command, `«${text}» — это ${command}`)
  }
  // Всё остальное командой не считается и остаётся без ответа: молчание бота
  // в ответ на случайный текст держится ровно на этом null.
  for (const text of ['стоп-урок', 'а как отписаться?', '', '/start', 'привет']) {
    assert.equal(readCommand(text), null, `«${text}» — не команда`)
  }

  // Транзакция откатилась — в базе не должно остаться ничего.
  const leftovers = await prisma.parentMessenger.count({ where: { externalId: MAX_USER } })
  assert.equal(leftovers, 0, 'транзакция откатилась, привязок не осталось')

  console.log('check-bind: всё сошлось')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
