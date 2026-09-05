import { z } from 'zod'

/**
 * Шаблоны напоминания родителю: описание подстановок, рендер и проверка.
 *
 * Живёт в `@repo/core`, а не в платформе или ботах, потому что рендер нужен
 * обоим: планировщик собирает по нему настоящее сообщение, форма настроек — то
 * же самое для превью. Две копии этой функции разошлись бы молча, и школа
 * увидела бы одно, а родитель получил другое.
 *
 * Шаблона два, и это не дробление ради дробления: сообщение одно, а занятий в
 * нём бывает несколько — у родителя двое детей или у ребёнка два урока в день.
 * Поэтому имя ученика, курс и время живут в шаблоне СТРОКИ, который рендерится
 * на каждое занятие, а дата и название школы — в шаблоне ТЕЛА, который
 * рендерится один раз.
 *
 * Форматирования нет намеренно: VK и MAX размечают текст по-разному (у MAX
 * `format: markdown`, у VK массив смещений `format_data`), так что одна
 * размеченная строка на обоих не работает. Появится нужда — шаблон станет
 * отрезками с пометками, а сериализация уедет в провайдеров.
 */

export type PlaceholderSpec = {
  /** То, что школа пишет в фигурных скобках. */
  key: string
  label: string
  hint: string
  /** Без обязательной сообщение теряет смысл, поэтому её отсутствие — ошибка. */
  required?: boolean
}

/** Подстановки тела сообщения — рендерятся один раз на письмо. */
export const TEMPLATE_PLACEHOLDERS = [
  {
    key: 'занятия',
    label: 'Занятия',
    hint: 'Список занятий — по строке на каждое, собранной из шаблона строки. Без него сообщение ни о чём, поэтому обязателен.',
    required: true,
  },
  {
    key: 'когда',
    label: 'Когда',
    hint: 'День занятий с «завтра» или «сегодня» — смотря какой режим выбран: «Завтра, 5 сентября» или «Сегодня, 5 сентября».',
  },
  {
    key: 'дата',
    label: 'Дата',
    hint: 'День занятий словами: «5 сентября». Без «завтра» и «сегодня» — только дата.',
  },
  {
    key: 'школа',
    label: 'Школа',
    hint: 'Название вашей школы. Бот один на всех, и родителю не всегда очевидно, от кого сообщение.',
  },
] as const satisfies readonly PlaceholderSpec[]

/** Подстановки строки занятия — рендерятся на каждое занятие в письме. */
export const LINE_PLACEHOLDERS = [
  {
    key: 'ученик',
    label: 'Ученик',
    hint: 'Имя и фамилия ребёнка. Обязательно: у родителя двоих детей строки без имени неразличимы.',
    required: true,
  },
  { key: 'курс', label: 'Курс', hint: 'Название курса, например «Программирование».' },
  { key: 'время', label: 'Время', hint: 'Начало занятия, «17:00».' },
  { key: 'место', label: 'Место', hint: 'Локация занятия, например «Ленина 5».' },
] as const satisfies readonly PlaceholderSpec[]

export type TemplateKey = (typeof TEMPLATE_PLACEHOLDERS)[number]['key']
export type LineKey = (typeof LINE_PLACEHOLDERS)[number]['key']

export type TemplateValues = Record<TemplateKey, string>
export type LineValues = Record<LineKey, string>

/** Любая пара фигурных скобок, даже с мусором внутри: незнакомые надо ловить. */
const PLACEHOLDER = /\{([^{}]*)\}/g

/**
 * Строка про `/stop` здесь — обычный текст, а не дописка рендера: школа вправе
 * её переписать или убрать. Сама команда работает всегда, независимо от того,
 * упомянута ли она в сообщении.
 */
export const DEFAULT_REMINDER_TEMPLATE = [
  '{когда}',
  '',
  '{занятия}',
  '',
  'Не сможете прийти — отметьте в кабинете.',
  '',
  'Отключить напоминания — /stop',
].join('\n')

export const DEFAULT_LINE_TEMPLATE = '• {ученик} — {курс}, {время}, {место}'

/** У MAX сообщение до 4000 символов, и список занятий ещё впереди. */
export const TEMPLATE_MAX_LENGTH = 1000
/** Строка повторяется на каждое занятие, поэтому потолок у неё свой и жёстче. */
export const LINE_MAX_LENGTH = 200

/**
 * Подставить значения. Ничего своего рендер к тексту не добавляет: что школа
 * написала, то родитель и получит.
 *
 * Незнакомая подстановка сюда не доходит — её отсекает `validateTemplate` на
 * сохранении. Если всё же дошла (значение из базы старше проверки), она
 * остаётся в тексте как есть: пустое место читалось бы как потерянный кусок
 * сообщения, а видимое `{чтотоне то}` — как то, что и есть, опечатка.
 */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return (
    template
      .replace(PLACEHOLDER, (match, key: string) => (key in values ? (values[key] ?? '') : match))
      // Подстановка может оказаться пустой (школа без названия), и на её месте
      // остаётся строка из пробелов — в мессенджере это дыра в сообщении.
      .replace(/[^\S\n]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

export type TemplateProblem = { code: 'empty' | 'unknown' | 'missing' | 'long'; message: string }

/**
 * Проверка шаблона на сохранении. Отдаёт первую проблему или `null`.
 *
 * Проверять обязательно и именно здесь: ошибку в шаблоне видно не сразу, а
 * когда сообщение уже ушло настоящим родителям, и только в журнале.
 */
export function validateTemplate(
  template: string,
  placeholders: readonly PlaceholderSpec[],
  maxLength: number,
): TemplateProblem | null {
  const trimmed = template.trim()

  if (trimmed.length === 0) {
    return { code: 'empty', message: 'Текст не может быть пустым.' }
  }

  if (trimmed.length > maxLength) {
    return {
      code: 'long',
      message: `Слишком длинный текст: ${trimmed.length} символов из ${maxLength}.`,
    }
  }

  const known = new Set(placeholders.map((p) => p.key))
  const unknown = [...trimmed.matchAll(PLACEHOLDER)]
    .map((match) => match[1] ?? '')
    .find((key) => !known.has(key))

  if (unknown !== undefined) {
    return {
      code: 'unknown',
      message: `Неизвестная подстановка {${unknown}}. Доступны: ${[...known].map((k) => `{${k}}`).join(', ')}.`,
    }
  }

  const missing = placeholders.find((p) => p.required && !trimmed.includes(`{${p.key}}`))
  if (missing) {
    return {
      code: 'missing',
      message:
        missing.key === 'занятия'
          ? 'Без {занятия} в сообщении не будет самих занятий.'
          : `Без {${missing.key}} строку занятия не прочитать.`,
    }
  }

  return null
}

function templateSchema(placeholders: readonly PlaceholderSpec[], maxLength: number) {
  return z
    .string()
    .max(maxLength)
    .superRefine((value, ctx) => {
      const problem = validateTemplate(value, placeholders, maxLength)
      if (problem) ctx.addIssue({ code: 'custom', message: problem.message })
    })
}

/** Схемы полей: та же проверка, но в форме, которую понимают экшены и форма. */
export const ReminderTemplateSchema = templateSchema(TEMPLATE_PLACEHOLDERS, TEMPLATE_MAX_LENGTH)
export const ReminderLineSchema = templateSchema(LINE_PLACEHOLDERS, LINE_MAX_LENGTH)
