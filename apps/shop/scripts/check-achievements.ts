/**
 * Самопроверка логики достижений: уровни, ключи, день рождения, серия.
 * Без фреймворка — обычные `assert`, падает с ненулевым кодом.
 *
 * Проверяет НАСТОЯЩИЙ код (импортирует реестр и хелперы), БД не трогает.
 * tsx живёт в платформе, а алиас `@/src/...` — в конфиге шопа, отсюда оба флага:
 *
 *   pnpm --filter platform exec tsx --tsconfig ../shop/tsconfig.json ../shop/scripts/check-achievements.ts
 */
import assert from 'node:assert/strict'
import {
  ACHIEVEMENTS,
  claimedLevel,
  hasAnyClaim,
  tierKey,
} from '../src/features/achievements/registry'
import { birthdayKeyFor, countStreak, type Stats } from '../src/features/achievements/stats'

const base: Stats = {
  presentTotal: 0,
  presentStreak: 0,
  ordersCount: 0,
  coinsSpent: 0,
  completedGroups: 0,
  activeGroups: 0,
  birthdayKey: null,
  claimed: new Map(),
}

const claim = (...keys: string[]): Stats['claimed'] =>
  new Map(keys.map((k) => [k, { coins: 1, claimedAt: new Date() }]))

const find = (key: string) => ACHIEVEMENTS.find((a) => a.key === key)!

const attend = find('attend')
const birthday = find('birthday')
const welcome = find('welcome')

// ── Ключи уровней ──────────────────────────────────────────────────────────
assert.equal(tierKey(attend, base, 0), 'attend:10')
assert.equal(tierKey(attend, base, 3), 'attend:100')
assert.equal(tierKey(attend, base, 4), null, 'уровней всего 4')
// Достижение без уровней хранится под голым ключом
assert.equal(tierKey(welcome, base, 0), 'welcome')

// ── Текущий уровень ────────────────────────────────────────────────────────
assert.equal(claimedLevel(attend, base), 0)
assert.equal(claimedLevel(attend, { ...base, claimed: claim('attend:10') }), 1)
assert.equal(claimedLevel(attend, { ...base, claimed: claim('attend:10', 'attend:25') }), 2)
// Дыра в середине не считается: следующий уровень — первый незабранный
assert.equal(claimedLevel(attend, { ...base, claimed: claim('attend:10', 'attend:50') }), 1)
assert.equal(
  claimedLevel(attend, {
    ...base,
    claimed: claim('attend:10', 'attend:25', 'attend:50', 'attend:100'),
  }),
  4,
)

// ── День рождения: повторяемость по годам ──────────────────────────────────
const bday2026: Stats = { ...base, birthdayKey: 'birthday:2026' }
assert.equal(tierKey(birthday, bday2026, 0), 'birthday:2026')
assert.equal(claimedLevel(birthday, bday2026), 0)
assert.equal(claimedLevel(birthday, { ...bday2026, claimed: claim('birthday:2026') }), 1)
assert.equal(
  claimedLevel(birthday, { ...bday2026, claimed: claim('birthday:2025') }),
  0,
  'прошлогодний подарок не закрывает новый год',
)
// Нет даты рождения — достижения не существует, но полученное раньше не прячем
assert.equal(tierKey(birthday, base, 0), null)
assert.equal(hasAnyClaim(birthday, base), false)
assert.equal(hasAnyClaim(birthday, { ...base, claimed: claim('birthday:2025') }), true)

// ── Год подарка ────────────────────────────────────────────────────────────
assert.equal(birthdayKeyFor('2011-03-17', '2026-07-24'), 'birthday:2026', 'ДР уже прошёл')
assert.equal(birthdayKeyFor('2011-07-24', '2026-07-24'), 'birthday:2026', 'ДР сегодня')
assert.equal(birthdayKeyFor('2011-12-31', '2026-07-24'), 'birthday:2025', 'ДР ещё не наступил')
// 31 декабря: подарок доступен весь следующий год, а не один день
assert.equal(birthdayKeyFor('2011-12-31', '2026-01-01'), 'birthday:2025')
// 29 февраля в невисокосный год
assert.equal(birthdayKeyFor('2012-02-29', '2026-03-01'), 'birthday:2026')
assert.equal(birthdayKeyFor('2012-02-29', '2026-02-28'), 'birthday:2025')
assert.equal(birthdayKeyFor(null, '2026-07-24'), null)

// ── Серия посещений ────────────────────────────────────────────────────────
const row = (status: 'PRESENT' | 'ABSENT' | 'UNSPECIFIED') => ({ status: status as never })
assert.equal(countStreak([row('PRESENT'), row('PRESENT')]), 2)
assert.equal(
  countStreak([row('UNSPECIFIED'), row('PRESENT'), row('PRESENT')]),
  2,
  'неотмеченное занятие не обрывает серию',
)
assert.equal(countStreak([row('PRESENT'), row('ABSENT'), row('PRESENT')]), 1, 'пропуск обрывает')
assert.equal(countStreak([row('ABSENT'), row('PRESENT')]), 0)
assert.equal(countStreak([]), 0)

// ── Инварианты реестра ─────────────────────────────────────────────────────
for (const a of ACHIEVEMENTS) {
  assert.ok(a.tiers.length > 0, `${a.key}: нет уровней`)
  const targets = a.tiers.map((t) => t.target)
  // По возрастанию — на этом держится claimedLevel
  assert.deepEqual(
    targets,
    [...targets].sort((x, y) => x - y),
    `${a.key}: уровни не по возрастанию`,
  )
}
const keys = ACHIEVEMENTS.map((a) => a.key)
assert.equal(new Set(keys).size, keys.length, 'дублируются ключи достижений')

// ── Экономика ──────────────────────────────────────────────────────────────
// Награды меряются в занятиях: посещение = ATTENDANCE_COINS = 10 коинов
// (константа живёт в платформе, шоп её не импортирует — дублируем осознанно).
// Инварианты описаны над ACHIEVEMENTS.
const LESSON = 10
const sumCoins = (a: (typeof ACHIEVEMENTS)[number]) => a.tiers.reduce((sum, t) => sum + t.coins, 0)

for (const a of ACHIEVEMENTS) {
  for (const t of a.tiers) {
    assert.ok(t.coins <= 30 * LESSON, `${a.key}/${t.title}: ${t.coins} — больше 30 занятий разом`)
  }
}

// Стартовый рывок: всё, что закрывается первыми десятью занятиями.
const early =
  sumCoins(welcome) +
  find('streak').tiers.reduce((sum, t) => sum + (t.target <= 10 ? t.coins : 0), 0) +
  attend.tiers.reduce((sum, t) => sum + (t.target <= 10 ? t.coins : 0), 0)
assert.ok(early <= 20 * LESSON, `первые 10 занятий дают ${early} коинов — фронт-лоад`)

const total = ACHIEVEMENTS.reduce((sum, a) => sum + sumCoins(a), 0)
// Сейчас 1605. Потолок — 170 занятий: даже на дистанции `attend:100` (1000
// коинов посещаемостью) награды остаются добавкой, а не основным доходом.
assert.ok(total <= 170 * LESSON, `все награды вместе — ${total} коинов, больше 170 занятий`)

// Кешбэк за покупки обязан быть меньше 100%, иначе трата удешевляет следующую.
const spent = find('spent')
assert.ok(
  sumCoins(spent) < spent.tiers[spent.tiers.length - 1]!.target,
  'достижение spent возвращает больше, чем нужно потратить',
)

// Метрики «заработано за всё время» быть не должно: ACHIEVEMENT_CLAIM попадает
// в тот же леджер, и достижение начало бы считать собственные выплаты.
assert.equal(
  ACHIEVEMENTS.find((a) => a.key === 'earned'),
  undefined,
  'достижение `earned` — петля обратной связи, см. комментарий над ACHIEVEMENTS',
)

console.info(`достижения: ok (${ACHIEVEMENTS.length} шт., ${keys.join(', ')})`)
