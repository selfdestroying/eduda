/**
 * Самопроверка напоминаний на стороне платформы — раздел в кабинете родителя
 * и настройки школы. Настоящим кодом против настоящей БД, внутри транзакции,
 * которая в конце откатывается.
 *
 * Проверяются ядра (`cabinet.server.ts`, `settings.server.ts`), а не экшены:
 * экшен из скрипта не импортировать, `safe-action.ts` тянет `server-only`.
 * Сами экшены — две строки поверх этих ядер.
 *
 * Экраны проверяются здесь, а не в браузере: при скрытой панели предпросмотра
 * платформа не гидратируется и висит на скелетонах.
 *
 *   pnpm --filter platform exec tsx scripts/check-reminders.ts
 */
import './load-env'

import assert from 'node:assert/strict'
import { prisma } from '@repo/db'
import {
  DEFAULT_LINE_TEMPLATE,
  DEFAULT_REMINDER_TEMPLATE,
  LINE_MAX_LENGTH,
  LINE_PLACEHOLDERS,
  renderTemplate,
  TEMPLATE_MAX_LENGTH,
  TEMPLATE_PLACEHOLDERS,
  validateTemplate,
} from '@repo/core/reminder-template'
import { subDays } from 'date-fns'
import {
  disconnectCabinetMessenger,
  readCabinetMessengers,
} from '../src/features/notifications/cabinet.server'
import { readReminderLog, readReminderParents } from '../src/features/notifications/overview.server'
import {
  readReminderSettings,
  writeReminderSettings,
} from '../src/features/notifications/settings.server'
import type {
  ReminderLogListSchemaType,
  ReminderParentListSchemaType,
} from '../src/features/notifications/schemas'
import { todayYmdInTz } from '../src/lib/timezone'

const TZ = 'Europe/Moscow'

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
        select: { id: true, accessToken: true },
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

      // ─── Настройки школы ─────────────────────────────────────────────
      assert.deepEqual(
        await readReminderSettings(tx, org.id),
        {
          // Выключено: рассылка от имени школы — её решение, а не наше.
          remindersEnabled: false,
          // А когда включит — «за два часа до занятия»: напоминание накануне
          // вечером к моменту урока успевает забыться.
          reminderMode: 'SAME_DAY',
          reminderTime: '20:00',
          reminderLeadMinutes: 120,
          reminderTemplate: DEFAULT_REMINDER_TEMPLATE,
          reminderLineTemplate: DEFAULT_LINE_TEMPLATE,
        },
        'значения по умолчанию',
      )

      // Записывается режим, отличный от дефолтного, — иначе проверка сошлась бы
      // и на нетронутой колонке.
      const template = 'Привет от {школа}!\n\n{дата}\n\n{занятия}'
      const lineTemplate = '{ученик}: {курс} в {время}'
      const saved = await writeReminderSettings(tx, org.id, {
        remindersEnabled: true,
        reminderMode: 'DAY_BEFORE',
        reminderTime: '08:30',
        reminderLeadMinutes: 60,
        reminderTemplate: template,
        reminderLineTemplate: lineTemplate,
      })
      assert.deepEqual(
        saved,
        {
          remindersEnabled: true,
          reminderMode: 'DAY_BEFORE',
          reminderTime: '08:30',
          reminderLeadMinutes: 60,
          reminderTemplate: template,
          reminderLineTemplate: lineTemplate,
        },
        'настройки сохраняются и возвращаются как записаны',
      )
      assert.deepEqual(await readReminderSettings(tx, org.id), saved, 'и читаются обратно')

      // Запас в минутах при этом сохранился, хотя в выбранном режиме не
      // работает: школа переключает режим туда-сюда, и терять настройку
      // соседнего при каждом переключении незачем.
      assert.equal(saved.reminderLeadMinutes, 60, 'настройка неактивного режима не стирается')

      // Колонка в базе `Int`, а форма и планировщик знают закрытый список.
      // Мусор, попавший туда мимо схемы, не должен ломать чтение настроек.
      await tx.organization.update({ where: { id: org.id }, data: { reminderLeadMinutes: 47 } })
      assert.equal(
        (await readReminderSettings(tx, org.id)).reminderLeadMinutes,
        120,
        'значение вне списка читается как значение по умолчанию',
      )

      // ─── Экран школы: декорации ──────────────────────────────────────
      // К этому месту в организации уже есть два родителя: `parent` с погашенной
      // привязкой VK и `noPhone` без привязок вовсе. Третьего заводим живым —
      // так все три состояния списка сходятся в одной выборке.
      const course = await tx.course.create({
        data: { name: 'Курс', organizationId: org.id },
        select: { id: true },
      })
      const location = await tx.location.create({
        data: { name: 'Центр', organizationId: org.id },
        select: { id: true },
      })
      const group = await tx.group.create({
        data: {
          startDate: '2026-09-01',
          maxStudents: 10,
          courseId: course.id,
          locationId: location.id,
          organizationId: org.id,
        },
        select: { id: true },
      })

      const connected = await tx.parent.create({
        data: { firstName: 'Подключённый', organizationId: org.id },
        select: { id: true },
      })
      const live = await tx.parentMessenger.create({
        data: {
          provider: 'MAX',
          externalId: `check-cabinet-live-${stamp}`,
          parentId: connected.id,
          organizationId: org.id,
        },
        select: { id: true },
      })

      const owners = [connected.id, parent.id, noPhone.id]
      for (const [index, firstName] of ['Первый', 'Второй', 'Третий'].entries()) {
        const student = await tx.student.create({
          data: { firstName, lastName: 'Проверкин', organizationId: org.id },
          select: { id: true },
        })
        await tx.studentGroup.create({
          data: {
            studentId: student.id,
            groupId: group.id,
            organizationId: org.id,
            status: 'ACTIVE',
            statusChangedAt: '2026-09-01',
          },
        })
        await tx.studentParent.create({
          data: { studentId: student.id, parentId: owners[index]!, organizationId: org.id },
        })
      }

      const queued = {
        kind: 'LESSON_REMINDER',
        text: 'Завтра, 5 сентября',
        organizationId: org.id,
        parentMessengerId: live.id,
      }
      await tx.notificationOutbox.createMany({
        data: [
          {
            ...queued,
            dedupeKey: `check-cabinet-${stamp}-sent`,
            status: 'SENT',
            sentAt: new Date(),
          },
          {
            ...queued,
            dedupeKey: `check-cabinet-${stamp}-failed`,
            status: 'FAILED',
            attempts: 5,
            lastError: 'chat.not.found',
          },
          // Тридцатидневной давности — её отрежет фильтр периода в журнале.
          {
            ...queued,
            dedupeKey: `check-cabinet-${stamp}-old`,
            status: 'SENT',
            createdAt: subDays(new Date(), 30),
          },
        ],
      })

      // ─── Экран школы: родители ───────────────────────────────────────
      const parents = (input: Partial<ReminderParentListSchemaType> = {}) =>
        readReminderParents(tx, org.id, {
          page: 0,
          pageSize: 50,
          providers: [],
          connection: [],
          ...input,
        })

      assert.equal((await parents()).total, 3, 'без отбора видны все родители школы')
      assert.deepEqual(
        (await parents({ connection: ['connected'] })).rows.map((r) => r.id),
        [connected.id],
        'подключён — тот, у кого есть живая привязка',
      )
      assert.deepEqual(
        (await parents({ connection: ['unsubscribed'] })).rows.map((r) => r.id),
        [parent.id],
        'отписался — строки есть, но ни одной живой',
      )
      assert.deepEqual(
        (await parents({ connection: ['none'] })).rows.map((r) => r.id),
        [noPhone.id],
        'не подключён — привязок нет вовсе; именно этих родителей и дожимают',
      )
      assert.equal(
        (await parents({ providers: ['VK'] })).total,
        0,
        'канал спрашивают про живую привязку, а не про историю',
      )
      assert.equal(
        (await parents({ search: 'Проверкин' })).total,
        3,
        'поиск достаёт родителя по фамилии ученика',
      )
      assert.deepEqual(
        (await parents({ search: 'Первый Проверкин' })).rows.map((r) => r.id),
        [connected.id],
        'слова через AND: иначе «Имя Фамилия» не сужает выборку вовсе',
      )

      // ─── Экран школы: журнал ─────────────────────────────────────────
      const log = (input: Partial<ReminderLogListSchemaType> = {}) =>
        readReminderLog(tx, org.id, TZ, {
          page: 0,
          pageSize: 50,
          providers: [],
          statuses: [],
          ...input,
        })

      assert.equal((await log()).total, 3, 'в журнале видно всё, включая старое')
      assert.equal((await log({ statuses: ['FAILED'] })).total, 1, 'отбор по статусу')
      assert.equal(
        (await log({ search: 'Подключённый' })).total,
        3,
        'поиск в журнале идёт по родителю привязки',
      )
      const today = todayYmdInTz(TZ)
      assert.equal(
        (await log({ from: today, to: today })).total,
        2,
        'период режет по календарным дням школы: строка тридцатидневной давности не в счёт',
      )

      // ─── Шаблоны сообщения ───────────────────────────────────────────
      // Ядро чистое, базы не требует, но проверяется здесь же: рендер и
      // проверка — половина ответа на «что именно получит родитель».
      //
      // Двухуровневость видна прямо здесь: строка занятия рендерится на каждое
      // занятие, а тело — один раз, поверх уже собранного списка.
      const lines = [
        { ученик: 'Аня', курс: 'Программирование', время: '17:00', место: 'Центр' },
        { ученик: 'Миша', курс: 'Робототехника', время: '18:30', место: 'Центр' },
      ].map((row) => renderTemplate(lineTemplate, row))

      assert.deepEqual(
        lines,
        ['Аня: Программирование в 17:00', 'Миша: Робототехника в 18:30'],
        'строка занятия рендерится по своему шаблону, на каждое занятие своя',
      )

      assert.equal(
        renderTemplate(template, {
          занятия: lines.join('\n'),
          когда: 'Завтра, 5 сентября',
          дата: '5 сентября',
          школа: 'Алгоритм',
        }),
        [
          'Привет от Алгоритм!',
          '',
          '5 сентября',
          '',
          'Аня: Программирование в 17:00',
          'Миша: Робототехника в 18:30',
        ].join('\n'),
        'подстановки встали на места, ничего своего рендер не дописал',
      )

      // Строку про отписку рендер больше не навязывает: что школа написала, то
      // родитель и получит.
      assert.equal(
        renderTemplate('{занятия}', { занятия: 'урок' }),
        'урок',
        'рендер не добавляет к шаблону ни строки',
      )

      // Пустая подстановка не должна оставлять после себя дыру из пустых строк.
      assert.equal(
        renderTemplate('{школа}\n\n{занятия}', { занятия: 'урок', школа: '' }),
        'урок',
        'пустое значение не оставляет пустых строк',
      )

      // Дефолт по-прежнему упоминает `/stop` — теперь как обычный текст,
      // который школа вправе переписать.
      assert.ok(
        DEFAULT_REMINDER_TEMPLATE.includes('/stop'),
        'в шаблоне по умолчанию отписка названа',
      )

      const checkBody = (value: string) =>
        validateTemplate(value, TEMPLATE_PLACEHOLDERS, TEMPLATE_MAX_LENGTH)
      const checkLine = (value: string) =>
        validateTemplate(value, LINE_PLACEHOLDERS, LINE_MAX_LENGTH)

      assert.equal(checkBody(DEFAULT_REMINDER_TEMPLATE), null, 'дефолт тела проходит')
      assert.equal(checkLine(DEFAULT_LINE_TEMPLATE), null, 'дефолт строки проходит')
      assert.equal(checkBody('   ')?.code, 'empty', 'пустой шаблон отклонён')
      assert.equal(
        checkBody('{занятия} {ученик}')?.code,
        'unknown',
        'подстановка строки в теле не работает: списков занятий там несколько, а ученик один',
      )
      assert.equal(
        checkLine('{ученик} {занятия}')?.code,
        'unknown',
        'и наоборот: {занятия} внутри строки занятия было бы рекурсией',
      )
      assert.equal(checkBody('Просто текст')?.code, 'missing', 'без {занятия} сообщение ни о чём')
      assert.equal(
        checkLine('{курс} в {время}')?.code,
        'missing',
        'без {ученик} строки двух детей неразличимы',
      )
      assert.equal(
        checkBody(`{занятия}${'я'.repeat(TEMPLATE_MAX_LENGTH)}`)?.code,
        'long',
        'потолок длины',
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

  console.log('check-reminders: всё сошлось')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
