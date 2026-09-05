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
import {
  bindByPhone,
  bindByRef,
  readBindings,
  readCommand,
  resubscribeAll,
  unsubscribeAll,
} from '../src/bind'
import { todayYmdInTz } from '@repo/core/timezone'
import { normalizePhone, phoneFromVCard } from '../src/phone'
import { toggledText } from '../src/routes/max'
import { buildBindSummary } from '../src/summary'

class Rollback extends Error {}

/** Аккаунты «в мессенджерах» — лишь бы не пересекались с настоящими. */
const VK_USER = '999000111'
const MAX_USER = '999000222'

async function main() {
  const org = await prisma.organization.findFirst({
    select: { id: true, name: true, timezone: true },
  })
  if (!org) throw new Error('В базе нет ни одной организации — проверять не на чем')

  // Календарный день школы: им датируются группа и запись ученика в неё.
  const today = todayYmdInTz(org.timezone)

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

      // ─── Привязка по телефону (MAX) ────────────────────────────────────
      // Один номер записан по-разному и в двух школах: бот один на установку,
      // и оба ребёнка обязаны получить напоминания.
      const otherOrg = await tx.organization.create({
        data: { name: `check-bind-${Date.now()}`, slug: `check-bind-${Date.now()}` },
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

      const byPhone = await bindByPhone(tx, MAX_USER, '79991234567')
      assert.equal(byPhone.length, 2, 'один номер — оба родителя в разных школах')
      assert.deepEqual(
        byPhone.map((parent) => parent.firstName).sort(),
        ['Второй', 'Первый'],
        'записанный по-разному номер всё равно совпал',
      )

      const rows = await tx.parentMessenger.findMany({
        where: { provider: 'MAX', externalId: MAX_USER },
        select: { organizationId: true, phone: true },
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

      // Повтор не задваивает, а отписанного возвращает.
      await unsubscribeAll(tx, 'MAX', MAX_USER)
      const again = await bindByPhone(tx, MAX_USER, '79991234567')
      assert.equal(again.length, 2, 'повтор нашёл тех же')
      const revivedMax = await tx.parentMessenger.count({
        where: { provider: 'MAX', externalId: MAX_USER, unsubscribedAt: null },
      })
      assert.equal(revivedMax, 2, 'повторная отправка номера включает обратно')

      assert.equal(
        (await bindByPhone(tx, MAX_USER, '79995555555')).length,
        0,
        'чужой номер никого не привязывает',
      )

      // ─── Что этот аккаунт вообще привязал ──────────────────────────────
      // Ответ бота на команду зависит от трёх состояний, а не двух: привязок
      // нет вовсе, они есть и включены, они есть и отключены.
      const bindings = await readBindings(tx, 'MAX', MAX_USER)
      assert.equal(bindings.length, 2, 'обе школы видны одним списком')
      assert.ok(
        bindings.every((binding) => binding.active),
        'после повторной отправки номера обе включены',
      )
      assert.deepEqual(
        bindings.map((binding) => binding.organization).sort(),
        [org.name, otherOrg.name].sort(),
        'у каждой ссылки на кабинет своя школа',
      )
      assert.equal(
        (await readBindings(tx, 'MAX', '999000333')).length,
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
