/**
 * Проверка подписи группы.
 *
 * База здесь не нужна: `getGroupName` — чистая функция над уже выбранными
 * полями. Проверяется ровно то, ради чего она вынесена в `@repo/core/group`:
 * своё название побеждает, собранное собирается с понедельника, и группа без
 * расписания не получает хвостовой пробел.
 *
 *   pnpm --filter platform exec tsx scripts/check-group-name.ts
 */
import assert from 'node:assert/strict'
import { getGroupName, type GroupLabel } from '@repo/core/group'

let passed = 0
const ok = (name: string) => {
  passed += 1
  console.log(`  ✓ ${name}`)
}

/**
 * Объявление, а не стрелка: дальше идут блоки `{ … }`, и без точек с запятой
 * (стиль репо) парсер принял бы `({ … })` за список параметров стрелки.
 */
function group(over: Partial<GroupLabel> = {}): GroupLabel {
  return { name: null, course: { name: 'Питон' }, schedules: [], ...over }
}

// ─── Своё название ────────────────────────────────────────────────────
{
  const own = group({ name: 'Питон · A2 · вечер', schedules: [{ dayOfWeek: 1, time: '16:00' }] })
  assert.equal(getGroupName(own), 'Питон · A2 · вечер')
  ok('своё название побеждает расписание')

  // Пустая строка — это «имени нет»: форма отдаёт `''`, когда поле не тронули.
  assert.equal(getGroupName(group({ name: '' })), 'Питон')
  ok('пустое название считается отсутствующим')
}

// ─── Сборка из курса и расписания ─────────────────────────────────────
{
  const week = group({
    schedules: [
      { dayOfWeek: 6, time: '10:00' },
      { dayOfWeek: 1, time: '16:00' },
    ],
  })
  assert.equal(getGroupName(week), 'Питон Пн 16:00, Сб 10:00')
  ok('дни идут в порядке недели, а не в порядке выборки')

  // Воскресенье — конец недели, а не начало: `(d + 6) % 7`.
  const sunday = group({
    schedules: [
      { dayOfWeek: 0, time: '12:00' },
      { dayOfWeek: 3, time: '18:00' },
    ],
  })
  assert.equal(getGroupName(sunday), 'Питон Ср 18:00, Вс 12:00')
  ok('воскресенье встаёт в конец недели')
}

// ─── Группа без расписания ────────────────────────────────────────────
{
  // Расписание снимают при завершении группы, а подпись всё ещё показывают.
  assert.equal(getGroupName(group()), 'Питон')
  ok('без расписания остаётся один курс, без хвостового пробела')
}

console.log(`\nПодпись группы: ${passed} проверок прошло.`)
