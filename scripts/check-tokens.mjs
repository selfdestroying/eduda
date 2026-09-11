/*
 * Забор дизайн-системы: ловит произвольные значения там, где шкала уже есть.
 *
 * Размеры шрифта и радиусы задаются ступенями Tailwind, а не числами в скобках.
 * До этой проверки в коде жили 28 разных кеглей на 152 места — причём один и тот
 * же размер писался и в px, и в rem (`text-[11px]` и `text-[0.6875rem]`), так
 * что глазами дубли не ловились вовсе.
 *
 * Отступы и цвета намеренно не проверяются: там дрейфа нет (сверено — 95%
 * отступов лежит на штатной шкале), а запрет без нужды учит обходить забор.
 *
 * Побег — `ds-ok` в той же строке или в строке над ней, с причиной. Он обязан
 * существовать: `text-[0.85em]` у инлайнового кода относителен к родителю, и
 * ступень его не заменяет. Запрет без выхода обходят молча.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

const RULES = [
  { re: /text-\[/, msg: 'произвольный кегль — возьмите ступень: text-xs … text-4xl' },
  // Только литералы: `rounded-[calc(var(--radius-sm)-2px)]` и `rounded-[inherit]` —
  // это вложенная геометрия, производная от токена, и она законна.
  {
    re: /rounded(-[a-z]+)?-\[[0-9.]/,
    msg: 'произвольный радиус — возьмите ступень: rounded-xs … rounded-3xl',
  },
]

const ROOTS = ['apps', 'packages']
const files = []
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e === 'generated' || e === '.source') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (e.endsWith('.tsx')) files.push(p)
  }
}
for (const r of ROOTS) walk(r)

const bad = []
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    // Три строки вверх, а не одна: обоснование редко влезает в одну строку, а
    // побег, который не срабатывает из-за переноса, притворяется поломкой.
    if (lines.slice(Math.max(0, i - 3), i + 1).some((l) => l.includes('ds-ok'))) return
    for (const { re, msg } of RULES) {
      if (re.test(line))
        bad.push(`${f.split(sep).join('/')}:${i + 1}  ${msg}\n    ${line.trim().slice(0, 100)}`)
    }
  })
}

if (bad.length) {
  console.error(`\nПроизвольные значения мимо дизайн-системы (${bad.length}):\n`)
  console.error(bad.join('\n'))
  console.error('\nЕсли значение действительно вне шкалы — комментарий `ds-ok` с причиной.\n')
  process.exit(1)
}
console.log(`check-tokens: чисто (${files.length} файлов)`)
