import { DaysOfWeek } from './utils'

/** Маппинг CSV-колонок → внутренние ключи */
export const CSV_TABLE_CONFIGS = {
  courses: {
    label: 'Курсы',
    requiredHeaders: ['Название Курса'],
    validate: (rows: Record<string, string>[]) => validateCourses(rows),
  },
  locations: {
    label: 'Локации',
    requiredHeaders: ['Локация (кабинет)', 'Максимум посадочных мест'],
    validate: (rows: Record<string, string>[]) => validateLocations(rows),
  },
  members: {
    label: 'Преподаватели',
    requiredHeaders: ['ФИО Преподавателя', 'Email (Логин)', 'Роль'],
    validate: (rows: Record<string, string>[]) => validateMembers(rows),
  },
  groups: {
    label: 'Группы',
    requiredHeaders: [
      'Название Группы',
      'Преподаватель (Основной)',
      'День недели',
      'Время начала',
      'Длительность (мин)',
      'Дата Старта',
      'Количество уроков',
    ],
    validate: (rows: Record<string, string>[]) => validateGroups(rows),
  },
  students: {
    label: 'Ученики',
    requiredHeaders: ['ФИО Ученика', 'Возраст ученика'],
    validate: (rows: Record<string, string>[]) => validateStudents(rows),
  },
} as const

export type CSVTableType = keyof typeof CSV_TABLE_CONFIGS

export type ValidationError = {
  row: number
  column: string
  message: string
}

export type ValidationResult = {
  valid: boolean
  errors: ValidationError[]
  rowCount: number
}

function validateCourses(rows: Record<string, string>[]): ValidationResult {
  const errors: ValidationError[] = []
  const names = new Set<string>()
  rows.forEach((row, i) => {
    const name = row['Название Курса']
    if (!name) errors.push({ row: i + 2, column: 'Название Курса', message: 'Пустое название' })
    if (names.has(name))
      errors.push({ row: i + 2, column: 'Название Курса', message: `Дубликат: "${name}"` })
    names.add(name)
  })
  return { valid: errors.length === 0, errors, rowCount: rows.length }
}

function validateLocations(rows: Record<string, string>[]): ValidationResult {
  const errors: ValidationError[] = []
  rows.forEach((row, i) => {
    if (!row['Локация (кабинет)'])
      errors.push({ row: i + 2, column: 'Локация (кабинет)', message: 'Пустое название' })
    const max = parseInt(row['Максимум посадочных мест'])
    if (isNaN(max) || max <= 0)
      errors.push({
        row: i + 2,
        column: 'Максимум посадочных мест',
        message: 'Должно быть положительным числом',
      })
  })
  return { valid: errors.length === 0, errors, rowCount: rows.length }
}

function validateMembers(rows: Record<string, string>[]): ValidationResult {
  const errors: ValidationError[] = []
  const emails = new Set<string>()
  rows.forEach((row, i) => {
    if (!row['ФИО Преподавателя'])
      errors.push({ row: i + 2, column: 'ФИО Преподавателя', message: 'Пустое ФИО' })
    const email = row['Email (Логин)']
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push({ row: i + 2, column: 'Email (Логин)', message: 'Некорректный email' })
    if (emails.has(email))
      errors.push({ row: i + 2, column: 'Email (Логин)', message: `Дубликат: "${email}"` })
    emails.add(email)
    const role = row['Роль']?.toLowerCase()
    if (!role || !['admin', 'member', 'owner'].includes(role))
      errors.push({
        row: i + 2,
        column: 'Роль',
        message: 'Допустимые значения: admin, member, owner',
      })
  })
  return { valid: errors.length === 0, errors, rowCount: rows.length }
}

function validateGroups(rows: Record<string, string>[]): ValidationResult {
  const errors: ValidationError[] = []
  const allDays = [...DaysOfWeek.full.map((d) => d.toLowerCase())]
  rows.forEach((row, i) => {
    if (!row['Название Группы'])
      errors.push({ row: i + 2, column: 'Название Группы', message: 'Пустое название' })
    if (!row['Преподаватель (Основной)'])
      errors.push({
        row: i + 2,
        column: 'Преподаватель (Основной)',
        message: 'Не указан преподаватель',
      })
    const day = row['День недели']?.toLowerCase()
    if (!day || !allDays.includes(day))
      errors.push({
        row: i + 2,
        column: 'День недели',
        message: `Допустимые значения: ${DaysOfWeek.full.join(', ')}`,
      })
    if (!row['Время начала'] || !/^\d{1,2}:\d{2}$/.test(row['Время начала']))
      errors.push({
        row: i + 2,
        column: 'Время начала',
        message: 'Формат: ЧЧ:ММ',
      })
    const dur = parseInt(row['Длительность (мин)'])
    if (isNaN(dur) || dur <= 0)
      errors.push({
        row: i + 2,
        column: 'Длительность (мин)',
        message: 'Должно быть положительным числом',
      })
    if (!row['Дата Старта'] || isNaN(Date.parse(row['Дата Старта'])))
      errors.push({ row: i + 2, column: 'Дата Старта', message: 'Некорректная дата (YYYY-MM-DD)' })
    const lessonCount = parseInt(row['Количество уроков'])
    if (isNaN(lessonCount) || lessonCount <= 0)
      errors.push({
        row: i + 2,
        column: 'Количество уроков',
        message: 'Должно быть положительным числом',
      })
  })
  return { valid: errors.length === 0, errors, rowCount: rows.length }
}

function validateStudents(rows: Record<string, string>[]): ValidationResult {
  const errors: ValidationError[] = []
  rows.forEach((row, i) => {
    if (!row['ФИО Ученика'])
      errors.push({ row: i + 2, column: 'ФИО Ученика', message: 'Пустое ФИО' })
    const age = parseInt(row['Возраст ученика'])
    if (isNaN(age) || age < 3 || age > 25)
      errors.push({
        row: i + 2,
        column: 'Возраст ученика',
        message: 'Должен быть от 3 до 25',
      })
    const balance = row['Текущий Баланс (Занятий)']
    if (balance && isNaN(parseInt(balance)))
      errors.push({
        row: i + 2,
        column: 'Текущий Баланс (Занятий)',
        message: 'Должно быть числом',
      })
    const birthDate = row['Дата рождения (Опционально)']
    if (birthDate && isNaN(Date.parse(birthDate)))
      errors.push({
        row: i + 2,
        column: 'Дата рождения (Опционально)',
        message: 'Некорректная дата',
      })
  })
  return { valid: errors.length === 0, errors, rowCount: rows.length }
}

export function validateCSVHeaders(
  headers: string[],
  tableType: CSVTableType
): { valid: boolean; missing: string[] } {
  const config = CSV_TABLE_CONFIGS[tableType]
  const normalizedHeaders = headers.map((h) => h.trim())
  const missing = config.requiredHeaders.filter((req) => !normalizedHeaders.includes(req))
  return { valid: missing.length === 0, missing }
}

export function validateCSVData(
  rows: Record<string, string>[],
  tableType: CSVTableType
): ValidationResult {
  if (rows.length === 0)
    return { valid: false, errors: [{ row: 0, column: '-', message: 'Файл пуст' }], rowCount: 0 }
  return CSV_TABLE_CONFIGS[tableType].validate(rows)
}
