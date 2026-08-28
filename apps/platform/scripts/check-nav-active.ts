/**
 * Подсветка пунктов сайдбара (`src/components/sidebar/lib/path-active.ts`).
 *
 * Правило одно: горит самый точный пункт меню. Проверяется граница, на которой
 * оно ломалось, — вложенный путь. Голый `startsWith` не отличал карточку ученика
 * (`/students/123`, своего пункта нет — светить должен родитель) от соседнего
 * пункта того же меню (`/students/active`), и «Все ученики» подсвечивались
 * вместе с «Активными».
 *
 * БД не нужна — функции чистые:
 *
 *   pnpm --filter platform exec tsx scripts/check-nav-active.ts
 */
import assert from 'node:assert/strict'

import { navEntries } from '../src/components/sidebar/lib/nav-config'
import { isGroupActive, isPathActive } from '../src/components/sidebar/lib/path-active'

// Сосед по меню забирает подсветку себе — родитель не горит заодно с ним.
assert.equal(isPathActive('/students/active', '/students/active'), true)
assert.equal(isPathActive('/students/active', '/students'), false)
assert.equal(isPathActive('/students/completed', '/students'), false)
assert.equal(isPathActive('/students/absent', '/students'), false)
assert.equal(isPathActive('/students/dismissed', '/students'), false)
assert.equal(isPathActive('/groups/types', '/groups'), false)

// Своего пункта у пути нет — светит ближайший родитель. Иначе на карточке
// ученика или пакета сайдбар не подсвечивал бы ничего.
assert.equal(isPathActive('/students/123', '/students'), true)
assert.equal(isPathActive('/finances/packages/42', '/finances/packages'), true)

// Общий префикс — это не вложенность.
assert.equal(isPathActive('/finances/profit-monthly', '/finances/profit'), false)

// Корень совпадает только сам с собой, иначе горел бы на каждой странице.
assert.equal(isPathActive('/', '/'), true)
assert.equal(isPathActive('/students', '/'), false)

// Группа-родитель при этом остаётся раскрытой и подсвеченной: она активна по
// любому своему пункту, а не по общему префиксу пути.
const students = navEntries.find((entry) => entry.kind === 'group' && entry.title === 'Ученики')
assert(students?.kind === 'group')
assert.equal(isGroupActive(students, '/students/active'), true)
assert.equal(isGroupActive(students, '/students/123'), true)
assert.equal(isGroupActive(students, '/groups'), false)

console.log('✓ Подсветка сайдбара: все проверки пройдены')
