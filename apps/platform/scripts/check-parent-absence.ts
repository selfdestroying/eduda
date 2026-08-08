/**
 * Самопроверка правил «что родителю можно» в кабинете (`parentAbsenceBlocker`).
 * Без фреймворка — обычные `assert`, падает с ненулевым кодом.
 *
 * Проверяет НАСТОЯЩИЙ код (импортирует предикат), БД не трогает: предикат чистый,
 * и это единственное место, где живут правила — server actions и кнопки в попапе
 * зовут его же.
 *
 *   pnpm --filter platform exec tsx scripts/check-parent-absence.ts
 */
import assert from 'node:assert/strict'
import {
  parentAbsenceBlocker,
  type BlockableAttendance,
  type BlockableLesson,
} from '../src/features/public-edit/lib'

const TODAY = '2026-08-07'
const FUTURE = '2026-08-20'
const PAST = '2026-07-01'

const activeLesson = (date: string): BlockableLesson => ({ date, status: 'ACTIVE' })

/** Неотмеченное будущее занятие — исходное состояние для «не сможем прийти». */
const unmarked: BlockableAttendance = {
  status: 'UNSPECIFIED',
  isWarned: null,
  parentMarkedAt: null,
  makeupForAttendanceId: null,
  makeupAttendance: null,
}

/** Пропуск, отмеченный самим родителем. */
const parentWarned: BlockableAttendance = {
  status: 'ABSENT',
  isWarned: true,
  parentMarkedAt: new Date('2026-08-05T10:00:00Z'),
  makeupForAttendanceId: null,
  makeupAttendance: null,
}

const ok = (actual: string | null, label: string) =>
  assert.equal(actual, null, `${label}: ожидали разрешение, получили «${actual}»`)

const blocked = (actual: string | null, label: string) =>
  assert.ok(actual, `${label}: ожидали отказ, получили разрешение`)

// ─── Базовый сценарий ───────────────────────────────────────────────

ok(parentAbsenceBlocker(unmarked, activeLesson(FUTURE), TODAY, 'mark'), 'будущее занятие, mark')
ok(
  parentAbsenceBlocker(parentWarned, activeLesson(FUTURE), TODAY, 'unmark'),
  'своя отметка, unmark',
)
ok(
  parentAbsenceBlocker(parentWarned, activeLesson(FUTURE), TODAY, 'makeup'),
  'своя отметка, makeup',
)

// ─── Дедлайн: только будущие дни ────────────────────────────────────

blocked(parentAbsenceBlocker(unmarked, activeLesson(PAST), TODAY, 'mark'), 'прошедшее занятие')
blocked(
  parentAbsenceBlocker(unmarked, activeLesson(TODAY), TODAY, 'mark'),
  'занятие сегодня — дедлайн уже прошёл',
)
blocked(
  parentAbsenceBlocker(parentWarned, activeLesson(TODAY), TODAY, 'unmark'),
  'снять отметку в день занятия',
)

// ─── Отменённое занятие ─────────────────────────────────────────────

blocked(
  parentAbsenceBlocker(unmarked, { date: FUTURE, status: 'CANCELLED' }, TODAY, 'mark'),
  'отменённое занятие',
)

// ─── Чужие отметки родитель не трогает ──────────────────────────────

blocked(
  parentAbsenceBlocker({ ...unmarked, status: 'PRESENT' }, activeLesson(FUTURE), TODAY, 'mark'),
  'занятие уже отмечено преподавателем',
)
blocked(
  parentAbsenceBlocker(
    { ...parentWarned, parentMarkedAt: null },
    activeLesson(FUTURE),
    TODAY,
    'unmark',
  ),
  'снять отметку школы',
)
blocked(
  parentAbsenceBlocker(
    { ...parentWarned, parentMarkedAt: null },
    activeLesson(FUTURE),
    TODAY,
    'makeup',
  ),
  'отработка за отметку школы',
)
blocked(
  parentAbsenceBlocker(
    { ...unmarked, status: 'ABSENT', isWarned: false },
    activeLesson(FUTURE),
    TODAY,
    'unmark',
  ),
  'непредупреждённый пропуск (его ставит школа)',
)

// ─── Отработка ──────────────────────────────────────────────────────

const withMakeup: BlockableAttendance = {
  ...parentWarned,
  makeupAttendance: { status: 'UNSPECIFIED', parentMarkedAt: new Date('2026-08-06T10:00:00Z') },
}

blocked(
  parentAbsenceBlocker(withMakeup, activeLesson(FUTURE), TODAY, 'makeup'),
  'вторая отработка за тот же пропуск',
)
ok(
  parentAbsenceBlocker(withMakeup, activeLesson(FUTURE), TODAY, 'unmark'),
  'снять отметку вместе со своей неотмеченной отработкой',
)
blocked(
  parentAbsenceBlocker(
    { ...parentWarned, makeupAttendance: { status: 'UNSPECIFIED', parentMarkedAt: null } },
    activeLesson(FUTURE),
    TODAY,
    'unmark',
  ),
  'снять отметку, когда отработку назначила школа',
)
blocked(
  parentAbsenceBlocker(
    {
      ...parentWarned,
      makeupAttendance: { status: 'PRESENT', parentMarkedAt: new Date() },
    },
    activeLesson(FUTURE),
    TODAY,
    'unmark',
  ),
  'снять отметку, когда отработку уже отметил преподаватель',
)

// ─── Сама запись-отработка ──────────────────────────────────────────

const makeupRow: BlockableAttendance = {
  status: 'UNSPECIFIED',
  isWarned: null,
  parentMarkedAt: new Date('2026-08-06T10:00:00Z'),
  makeupForAttendanceId: 42,
  makeupAttendance: null,
}

ok(parentAbsenceBlocker(makeupRow, activeLesson(FUTURE), TODAY, 'cancelMakeup'), 'отмена отработки')
blocked(
  parentAbsenceBlocker(makeupRow, activeLesson(FUTURE), TODAY, 'mark'),
  'отметить пропуск на самой отработке',
)
blocked(
  parentAbsenceBlocker(makeupRow, activeLesson(FUTURE), TODAY, 'makeup'),
  'отработка за отработку',
)
blocked(
  parentAbsenceBlocker(
    { ...makeupRow, parentMarkedAt: null },
    activeLesson(FUTURE),
    TODAY,
    'cancelMakeup',
  ),
  'отменить отработку, назначенную школой',
)
blocked(
  parentAbsenceBlocker(
    { ...makeupRow, status: 'PRESENT' },
    activeLesson(FUTURE),
    TODAY,
    'cancelMakeup',
  ),
  'отменить уже отмеченную отработку',
)
blocked(
  parentAbsenceBlocker(unmarked, activeLesson(FUTURE), TODAY, 'cancelMakeup'),
  'отменить отработку у обычной записи',
)

console.log('check-parent-absence: OK')
