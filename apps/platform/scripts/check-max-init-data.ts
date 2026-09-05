/**
 * Проверка подписи данных запуска мини-приложения MAX.
 *
 * База здесь не нужна вовсе: `verifyInitData` — чистая функция, и проверяется
 * ровно то, ради чего она написана, — что подделанную строку она не пропускает.
 * Подписываем набор тем же рецептом, что и MAX, и дальше портим по одной вещи
 * за раз.
 *
 *   pnpm --filter platform exec tsx scripts/check-max-init-data.ts
 */
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyInitData } from '../src/lib/max-init-data'

const TOKEN = 'проверочный:токен-бота'

let passed = 0
const ok = (name: string) => {
  passed += 1
  console.log(`  ✓ ${name}`)
}

/** Тот же рецепт, что в документации MAX, — иначе проверялась бы сама с собой. */
function sign(params: Record<string, string>): string {
  const launchParams = Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest()
  const hash = createHmac('sha256', secret).update(launchParams).digest('hex')

  return [...Object.entries(params), ['hash', hash]]
    .map(([key, value]) => `${key}=${encodeURIComponent(value!)}`)
    .join('&')
}

const now = Date.now()
const authDate = String(Math.floor(now / 1000))
const user = JSON.stringify({ id: 4815162342, first_name: 'Мария', username: 'maria' })

function reason(initData: string, at = now): string {
  const result = verifyInitData(initData, TOKEN, at)
  assert.equal(result.ok, false, 'строка не должна была пройти проверку')
  return result.ok ? '' : result.reason
}

// ─── Целая строка проходит ────────────────────────────────────────────
{
  const result = verifyInitData(sign({ auth_date: authDate, query_id: 'q1', user }), TOKEN, now)
  assert.ok(result.ok, `целая строка должна проходить, а получили: ${result.ok || result.reason}`)
  assert.deepEqual(
    result.user,
    // id строкой — как `ParentMessenger.externalId`, по которому идёт поиск.
    { id: '4815162342', firstName: 'Мария' },
    'из подписанной строки должен доставаться пользователь',
  )
  ok('целая строка проходит и отдаёт пользователя')
}

// ─── Подделки ─────────────────────────────────────────────────────────
{
  // Подменённый id — то, ради чего вся проверка: без неё чужой кабинет
  // открывался бы правкой одной строки в консоли браузера.
  const forged = sign({ auth_date: authDate, user }).replace(
    encodeURIComponent(user),
    encodeURIComponent(JSON.stringify({ id: 1, first_name: 'Не Мария' })),
  )
  assert.equal(reason(forged), 'подпись не сошлась')
  ok('подменённый пользователь не проходит')
}

{
  assert.equal(
    reason(sign({ auth_date: authDate, user }).replace(/hash=.*/, 'hash=deadbeef')),
    'подпись не сошлась',
  )
  ok('чужая подпись не проходит')
}

{
  const result = verifyInitData(sign({ auth_date: authDate, user }), 'другой токен', now)
  assert.equal(result.ok, false, 'строка от чужого бота не должна проходить')
  ok('строка, подписанная чужим токеном, не проходит')
}

{
  assert.equal(
    reason(`auth_date=${authDate}&user=${encodeURIComponent(user)}`),
    'в строке запуска нет подписи',
  )
  ok('строка без подписи не проходит')
}

// ─── Срок годности и форма ────────────────────────────────────────────
{
  const stale = sign({ auth_date: String(Math.floor(now / 1000) - 2 * 60 * 60), user })
  assert.equal(reason(stale), 'строка запуска устарела')
  ok('строка старше часа не проходит')
}

{
  assert.equal(reason(sign({ auth_date: authDate })), 'в строке запуска нет пользователя')
  ok('строка без пользователя не проходит')
}

{
  assert.equal(
    reason(sign({ auth_date: authDate, user: '{это не json' })),
    'пользователь в строке запуска не разобрался',
  )
  ok('неразбираемый пользователь не проходит')
}

{
  assert.equal(
    reason(sign({ auth_date: authDate, user: JSON.stringify({ first_name: 'Без id' }) })),
    'у пользователя в строке запуска нет id',
  )
  ok('пользователь без id не проходит')
}

// ─── Порядок и кодирование ────────────────────────────────────────────
{
  // Пары в строке приходят в произвольном порядке, а подписан отсортированный
  // набор: если сортировку потерять, проверка развалится именно здесь.
  const shuffled = sign({ user, query_id: 'q1', auth_date: authDate })
    .split('&')
    .reverse()
    .join('&')
  const result = verifyInitData(shuffled, TOKEN, now)
  assert.ok(result.ok, 'порядок пар в строке не должен влиять на подпись')
  ok('порядок пар в строке не влияет на подпись')
}

console.log(`\nПодпись мини-приложения MAX: ${passed} проверок прошло.`)
