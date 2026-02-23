import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from 'better-auth/crypto'
import { fromZonedTime } from 'date-fns-tz'
import 'dotenv/config'
import ExcelJS from 'exceljs'
import { resolve } from 'path'
import { transliterate } from 'transliteration'
import { PrismaClient } from './generated/client'

// ─── Конфигурация ───────────────────────────────────────────────────────────

const TIMEZONE = 'Europe/Moscow'
const DEFAULT_PASSWORD = '12345'
const DEFAULT_BIRTH_DATE = new Date(1900, 0, 1) // 01.01.1900 — маркер отсутствующей даты рождения
const FILE_NAME = process.argv[2] || 'import-template-improved.xlsx'

// ─── Prisma клиент ──────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ─── Типы ───────────────────────────────────────────────────────────────────

interface CourseRow {
  name: string
}

interface LocationRow {
  name: string
}

interface MemberRow {
  name: string
  email: string
  role: string
  bidForLesson: number
  bidForIndividual: number
  bonusPerStudent: number
}

interface GroupRow {
  name: string
  course: string
  type: string
  teacher: string
  substituteTeacher: string
  dayOfWeek: string
  time: string
  location: string
  startDate: string
  lessonCount: number
  maxStudents: number
  url: string
}

interface StudentRow {
  firstName: string
  lastName: string
  birthDate: string
  parentsName: string
  parentsPhone: string
  groups: string
  lessonsBalance: number
  totalPayments: number
  url: string
}

// ─── Маппинг заголовков XLSX → ключи объектов ──────────────────────────────

const COURSES_HEADER_MAP: Record<string, keyof CourseRow> = {
  'Название *': 'name',
  Название: 'name',
}

const LOCATIONS_HEADER_MAP: Record<string, keyof LocationRow> = {
  'Название *': 'name',
  Название: 'name',
}

const MEMBERS_HEADER_MAP: Record<string, keyof MemberRow> = {
  'ФИО *': 'name',
  ФИО: 'name',
  'Email *': 'email',
  Email: 'email',
  'Роль *': 'role',
  Роль: 'role',
  'Ставка за групповой урок': 'bidForLesson',
  'Ставка за индивид. урок': 'bidForIndividual',
  'Бонус за ученика': 'bonusPerStudent',
}

const GROUPS_HEADER_MAP: Record<string, keyof GroupRow> = {
  'Название группы *': 'name',
  'Название группы': 'name',
  'Курс *': 'course',
  Курс: 'course',
  'Тип *': 'type',
  Тип: 'type',
  'Преподаватель *': 'teacher',
  Преподаватель: 'teacher',
  'Запасной преподаватель': 'substituteTeacher',
  'Дни недели *': 'dayOfWeek',
  'Дни недели': 'dayOfWeek',
  'Время *': 'time',
  Время: 'time',
  'Локация *': 'location',
  Локация: 'location',
  'Дата старта *': 'startDate',
  'Дата старта': 'startDate',
  'Кол-во уроков *': 'lessonCount',
  'Кол-во уроков': 'lessonCount',
  'Макс. студентов *': 'maxStudents',
  'Макс. студентов': 'maxStudents',
  Ссылка: 'url',
}

const STUDENTS_HEADER_MAP: Record<string, keyof StudentRow> = {
  'Имя *': 'firstName',
  Имя: 'firstName',
  'Фамилия *': 'lastName',
  Фамилия: 'lastName',
  'Дата рождения *': 'birthDate',
  'Дата рождения': 'birthDate',
  'ФИО родителя': 'parentsName',
  'Телефон родителя': 'parentsPhone',
  'Группы *': 'groups',
  Группы: 'groups',
  'Баланс занятий': 'lessonsBalance',
  'Текущий Баланс (Занятий)': 'lessonsBalance',
  'Текущий Баланс (Рублей/Долга)': 'totalPayments',
  Ссылка: 'url',
}

// ─── Хелперы ────────────────────────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  воскресенье: 0,
  понедельник: 1,
  вторник: 2,
  среда: 3,
  четверг: 4,
  пятница: 5,
  суббота: 6,
  вс: 0,
  пн: 1,
  вт: 2,
  ср: 3,
  чт: 4,
  пт: 5,
  сб: 6,
}

function parseDayOfWeek(raw: string): number {
  const key = raw.trim().toLowerCase()
  const day = DAY_MAP[key]
  if (day === undefined) throw new Error(`Неизвестный день недели: "${raw}"`)
  return day
}

function parseGroupType(raw: string): 'GROUP' | 'INDIVIDUAL' | 'INTENSIVE' {
  const t = raw.trim().toLowerCase()
  if (t === 'группа' || t.startsWith('группа') || t.startsWith('сплит')) return 'GROUP'
  if (t === 'индивидуально' || t.startsWith('индив')) return 'INDIVIDUAL'
  if (t === 'интенсив' || t.startsWith('интенс')) return 'INTENSIVE'
  throw new Error(`Неизвестный тип группы: "${raw}"`)
}

function parseDate(raw: string | Date): Date {
  // Если Excel вернул объект Date напрямую
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) throw new Error(`Невалидный объект Date`)
    return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate())
  }

  const trimmed = raw.trim()

  // Формат DD.MM.YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // Формат YYYY-MM-DD (ISO)
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [, year, month, day] = iso
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // JS Date.toString() формат (например "Fri Aug 15 2025 00:00:00 GMT+0000 ...")
  const jsDate = new Date(trimmed)
  if (!isNaN(jsDate.getTime())) {
    return new Date(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate())
  }

  throw new Error(`Неверный формат даты: "${raw}". Ожидается ДД.ММ.ГГГГ`)
}

function parseRoleToMemberRole(raw: string): string {
  const r = raw.trim().toLowerCase()
  if (r === 'преподаватель') return 'teacher'
  if (r === 'менеджер') return 'manager'
  if (r === 'владелец') return 'owner'
  throw new Error(`Неизвестная роль: "${raw}"`)
}

function generateLogin(firstName: string, lastName: string): string {
  const translitFirst = transliterate(firstName)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const translitLast = transliterate(lastName)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return `${translitFirst}.${translitLast}`
}

function calculateAge(birthDate: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

function generatePassword(): string {
  return Math.random().toString(36).slice(2, 8)
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function cellToString(cell: ExcelJS.CellValue): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) {
    // Excel хранит время как Date с базовой датой 1899-12-30 — извлекаем HH:MM
    const hours = cell.getUTCHours().toString().padStart(2, '0')
    const minutes = cell.getUTCMinutes().toString().padStart(2, '0')
    if (cell.getFullYear() <= 1900) {
      return `${hours}:${minutes}`
    }
    return cell.toString()
  }
  if (typeof cell !== 'object') return String(cell).trim()

  // Гиперссылка: { text: string | { richText: [...] }, hyperlink: string }
  if ('hyperlink' in cell) {
    const hCell = cell as { text?: unknown; hyperlink?: string }
    if (typeof hCell.text === 'string') return hCell.text.trim()
    if (hCell.hyperlink)
      return String(hCell.hyperlink)
        .replace(/^mailto:/, '')
        .trim()
  }

  // Простое текстовое значение
  if ('text' in cell && typeof (cell as { text: unknown }).text === 'string') {
    return String((cell as { text: string }).text).trim()
  }

  // Rich text: { richText: [{ text: string }, ...] }
  if ('richText' in cell && Array.isArray((cell as { richText: unknown[] }).richText)) {
    return (cell as { richText: Array<{ text: string }> }).richText
      .map((part) => part.text)
      .join('')
      .trim()
  }

  // Формула: { result: ... }
  if ('result' in cell) {
    return String((cell as { result: unknown }).result).trim()
  }

  return String(cell).trim()
}

function cellToNumber(cell: ExcelJS.CellValue): number {
  const str = cellToString(cell)
  if (!str) return 0
  const num = parseInt(str, 10)
  return isNaN(num) ? 0 : num
}

// ─── Чтение листа XLSX ─────────────────────────────────────────────────────

function readSheet<T>(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headerMap: Record<string, keyof T>,
  numericFields: Set<keyof T> = new Set()
): T[] {
  const sheet = workbook.getWorksheet(sheetName)
  if (!sheet) {
    console.warn(`  ⚠ Лист "${sheetName}" не найден, пропускаем`)
    return []
  }

  // Читаем заголовки из первой строки
  const headerRow = sheet.getRow(1)
  const colMap = new Map<number, keyof T>()

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const headerText = cellToString(cell.value)
    const key = headerMap[headerText]
    if (key) {
      colMap.set(colNumber, key)
    }
  })

  if (colMap.size === 0) {
    console.warn(`  ⚠ Лист "${sheetName}": не удалось сопоставить заголовки`)
    return []
  }

  // Читаем данные
  const rows: T[] = []
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return // пропускаем заголовок

    const obj: Record<string, unknown> = {}
    let hasData = false

    for (const [colNumber, key] of colMap) {
      const cellValue = row.getCell(colNumber).value
      if (numericFields.has(key)) {
        obj[key as string] = cellToNumber(cellValue)
      } else {
        const str = cellToString(cellValue)
        obj[key as string] = str
        if (str) hasData = true
      }
    }

    // Пропускаем полностью пустые строки
    if (hasData) {
      rows.push(obj as T)
    }
  })

  return rows
}

// ─── Валидация ──────────────────────────────────────────────────────────────

interface ValidationError {
  sheet: string
  row: number
  field: string
  message: string
}

function validateRequired<T>(
  rows: T[],
  sheetName: string,
  requiredFields: Array<{ key: keyof T; label: string }>
): ValidationError[] {
  const errors: ValidationError[] = []
  rows.forEach((row, i) => {
    for (const { key, label } of requiredFields) {
      const val = (row as Record<string, unknown>)[key as string]
      if (val === undefined || val === null || val === '') {
        errors.push({
          sheet: sheetName,
          row: i + 2, // +1 за заголовок, +1 за 0-based
          field: label,
          message: `Обязательное поле "${label}" пустое`,
        })
      }
    }
  })
  return errors
}

// ─── Основной импорт ────────────────────────────────────────────────────────

async function main() {
  const filePath = resolve(process.cwd(), FILE_NAME)
  console.log(`\n📂 Файл: ${filePath}\n`)

  // ── Чтение XLSX ────────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  const sheetNames = workbook.worksheets.map((s) => s.name)
  console.log(`📋 Листы: ${sheetNames.join(', ')}\n`)

  // ── Парсинг всех листов ────────────────────────────────────────────────
  const coursesData = readSheet<CourseRow>(workbook, 'Курсы', COURSES_HEADER_MAP)
  const locationsData = readSheet<LocationRow>(workbook, 'Локации', LOCATIONS_HEADER_MAP)
  const membersData = readSheet<MemberRow>(
    workbook,
    'Сотрудники',
    MEMBERS_HEADER_MAP,
    new Set<keyof MemberRow>(['bidForLesson', 'bidForIndividual', 'bonusPerStudent'])
  )
  const groupsData = readSheet<GroupRow>(
    workbook,
    'Группы',
    GROUPS_HEADER_MAP,
    new Set<keyof GroupRow>(['lessonCount', 'maxStudents'])
  )
  const studentsData = readSheet<StudentRow>(
    workbook,
    'Студенты',
    STUDENTS_HEADER_MAP,
    new Set<keyof StudentRow>(['lessonsBalance', 'totalPayments'])
  )

  console.log(`  Курсов:      ${coursesData.length}`)
  console.log(`  Локаций:     ${locationsData.length}`)
  console.log(`  Сотрудников: ${membersData.length}`)
  console.log(`  Групп:       ${groupsData.length}`)
  console.log(`  Студентов:   ${studentsData.length}`)
  console.log()

  // ── Валидация ──────────────────────────────────────────────────────────
  const allErrors: ValidationError[] = [
    ...validateRequired(coursesData, 'Курсы', [{ key: 'name', label: 'Название' }]),
    ...validateRequired(locationsData, 'Локации', [{ key: 'name', label: 'Название' }]),
    ...validateRequired(membersData, 'Сотрудники', [
      { key: 'name', label: 'ФИО' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Роль' },
    ]),
    ...validateRequired(groupsData, 'Группы', [
      { key: 'name', label: 'Название группы' },
      { key: 'course', label: 'Курс' },
      { key: 'type', label: 'Тип' },
      { key: 'teacher', label: 'Преподаватель' },
      { key: 'dayOfWeek', label: 'Дни недели' },
      { key: 'time', label: 'Время' },
      { key: 'location', label: 'Локация' },
      { key: 'startDate', label: 'Дата старта' },
    ]),
    ...validateRequired(studentsData, 'Студенты', [
      { key: 'firstName', label: 'Имя' },
      { key: 'lastName', label: 'Фамилия' },
      { key: 'groups', label: 'Группы' },
    ]),
  ]

  // Проверяем ссылочную целостность
  const courseNames = new Set(coursesData.map((c) => normalizeName(c.name)))
  const locationNames = new Set(locationsData.map((l) => normalizeName(l.name)))
  const memberNames = new Set(membersData.map((m) => normalizeName(m.name)))
  const groupNames = new Set(groupsData.map((g) => normalizeName(g.name)))

  groupsData.forEach((g, i) => {
    if (g.course && !courseNames.has(normalizeName(g.course))) {
      allErrors.push({
        sheet: 'Группы',
        row: i + 2,
        field: 'Курс',
        message: `Курс "${g.course}" не найден в листе «Курсы»`,
      })
    }
    if (g.location && !locationNames.has(normalizeName(g.location))) {
      allErrors.push({
        sheet: 'Группы',
        row: i + 2,
        field: 'Локация',
        message: `Локация "${g.location}" не найдена в листе «Локации»`,
      })
    }
    if (g.teacher && !memberNames.has(normalizeName(g.teacher))) {
      allErrors.push({
        sheet: 'Группы',
        row: i + 2,
        field: 'Преподаватель',
        message: `Преподаватель "${g.teacher}" не найден в листе «Сотрудники»`,
      })
    }
    if (g.substituteTeacher && !memberNames.has(normalizeName(g.substituteTeacher))) {
      allErrors.push({
        sheet: 'Группы',
        row: i + 2,
        field: 'Запасной преподаватель',
        message: `Запасной преподаватель "${g.substituteTeacher}" не найден в листе «Сотрудники»`,
      })
    }
  })

  studentsData.forEach((s, i) => {
    if (s.groups) {
      const studentGroups = s.groups
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean)
      for (const gName of studentGroups) {
        if (!groupNames.has(normalizeName(gName))) {
          allErrors.push({
            sheet: 'Студенты',
            row: i + 2,
            field: 'Группы',
            message: `Группа "${gName}" не найдена в листе «Группы»`,
          })
        }
      }
    }
  })

  // Проверяем уникальность
  const seenCourses = new Set<string>()
  coursesData.forEach((c, i) => {
    const norm = normalizeName(c.name)
    if (seenCourses.has(norm)) {
      allErrors.push({
        sheet: 'Курсы',
        row: i + 2,
        field: 'Название',
        message: `Дубликат курса: "${c.name}"`,
      })
    }
    seenCourses.add(norm)
  })

  const seenLocations = new Set<string>()
  locationsData.forEach((l, i) => {
    const norm = normalizeName(l.name)
    if (seenLocations.has(norm)) {
      allErrors.push({
        sheet: 'Локации',
        row: i + 2,
        field: 'Название',
        message: `Дубликат локации: "${l.name}"`,
      })
    }
    seenLocations.add(norm)
  })

  const seenEmails = new Set<string>()
  membersData.forEach((m, i) => {
    const norm = m.email.trim().toLowerCase()
    if (seenEmails.has(norm)) {
      allErrors.push({
        sheet: 'Сотрудники',
        row: i + 2,
        field: 'Email',
        message: `Дубликат email: "${m.email}"`,
      })
    }
    seenEmails.add(norm)
  })

  const seenGroupNames = new Set<string>()
  groupsData.forEach((g, i) => {
    const norm = normalizeName(g.name)
    if (seenGroupNames.has(norm)) {
      allErrors.push({
        sheet: 'Группы',
        row: i + 2,
        field: 'Название группы',
        message: `Дубликат группы: "${g.name}"`,
      })
    }
    seenGroupNames.add(norm)
  })

  if (allErrors.length > 0) {
    console.error(`\n❌ Найдено ${allErrors.length} ошибок валидации:\n`)
    for (const err of allErrors) {
      console.error(`  [${err.sheet}] Строка ${err.row}, поле "${err.field}": ${err.message}`)
    }
    console.error('\n⛔ Импорт отменён. Исправьте ошибки в файле и повторите.\n')
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log('✅ Валидация пройдена\n')

  // ── Запрашиваем / создаём организацию ──────────────────────────────────
  const orgSlug = process.argv[3] || 'imported-org'
  const orgName = process.argv[4] || 'Импортированная организация'

  let org = await prisma.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) {
    org = await prisma.organization.create({
      data: { name: orgName, slug: orgSlug },
    })
    console.log(`✓ Организация создана: "${org.name}" (id=${org.id})\n`)
  } else {
    console.log(`✓ Организация найдена: "${org.name}" (id=${org.id})\n`)
  }
  const ORG_ID = org.id

  // ═══ 1. Курсы ═════════════════════════════════════════════════════════════
  console.log('--- 1. Импорт курсов ---')
  const courseMap = new Map<string, number>() // normalizedName → courseId

  for (const row of coursesData) {
    const name = row.name.trim()
    const course = await prisma.course.create({
      data: { name, organizationId: ORG_ID },
    })
    courseMap.set(normalizeName(name), course.id)
    console.log(`  + Курс: "${name}" (id=${course.id})`)
  }
  console.log(`✓ Курсов: ${courseMap.size}\n`)

  // ═══ 2. Локации ═══════════════════════════════════════════════════════════
  console.log('--- 2. Импорт локаций ---')
  const locationMap = new Map<string, number>() // normalizedName → locationId

  for (const row of locationsData) {
    const name = row.name.trim()
    const location = await prisma.location.create({
      data: { name, organizationId: ORG_ID },
    })
    locationMap.set(normalizeName(name), location.id)
    console.log(`  + Локация: "${name}" (id=${location.id})`)
  }
  console.log(`✓ Локаций: ${locationMap.size}\n`)

  // ═══ 3. Сотрудники (User + Account + Member) ═════════════════════════════
  console.log('--- 3. Импорт сотрудников ---')
  const userMap = new Map<string, number>() // normalizedName → userId
  const hashedDefaultPassword = await hashPassword(DEFAULT_PASSWORD)

  for (const row of membersData) {
    const name = row.name.trim()
    const email = row.email.trim()
    const role = parseRoleToMemberRole(row.role)
    const bidForLesson = row.bidForLesson || 0
    const bidForIndividual = row.bidForIndividual || 0
    const bonusPerStudent = row.bonusPerStudent || 0

    const user = await prisma.user.create({
      data: {
        name,
        email,
        bidForLesson,
        bidForIndividual,
        bonusPerStudent,
        role: 'user',
      },
    })

    await prisma.account.create({
      data: {
        accountId: user.id.toString(),
        providerId: 'credential',
        userId: user.id,
        password: hashedDefaultPassword,
      },
    })

    await prisma.member.create({
      data: {
        organizationId: ORG_ID,
        userId: user.id,
        role,
      },
    })

    userMap.set(normalizeName(name), user.id)
    console.log(
      `  + ${name} (id=${user.id}, email=${email}, роль=${role}, ставка=${bidForLesson}/${bidForIndividual}, бонус=${bonusPerStudent})`
    )
  }
  console.log(`✓ Сотрудников: ${userMap.size}\n`)

  // ═══ 4. Группы (Group + GroupSchedule + TeacherGroup + Lessons) ════════════
  console.log('--- 4. Импорт групп ---')
  const groupMap = new Map<string, number>() // normalizedGroupName → groupId
  const lessonsByGroup = new Map<number, Array<{ id: number; organizationId: number }>>()

  for (const row of groupsData) {
    const groupName = row.name.trim()
    const courseId = courseMap.get(normalizeName(row.course))!
    const locationId = locationMap.get(normalizeName(row.location))!
    const groupType = parseGroupType(row.type)
    const startDate = parseDate(row.startDate)
    const lessonCount = row.lessonCount || 30
    const maxStudents = row.maxStudents || 10

    // Парсим дни и время (через запятую)
    const days = row.dayOfWeek
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
    const times = row.time
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const schedules: Array<{ dayOfWeek: number; time: string }> = []
    for (let i = 0; i < days.length; i++) {
      schedules.push({
        dayOfWeek: parseDayOfWeek(days[i]),
        // Если время одно — используем его для всех дней
        time: times.length === 1 ? times[0] : times[i] || times[0],
      })
    }

    const primarySchedule = schedules[0]

    const group = await prisma.group.create({
      data: {
        startDate,
        dayOfWeek: primarySchedule.dayOfWeek,
        time: primarySchedule.time,
        maxStudents,
        type: groupType,
        url: row.url || null,
        organizationId: ORG_ID,
        courseId,
        locationId,
      },
    })

    // GroupSchedule
    await prisma.groupSchedule.createMany({
      data: schedules.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        time: s.time,
        groupId: group.id,
        organizationId: ORG_ID,
      })),
      skipDuplicates: true,
    })

    // Привязка преподавателей (TeacherGroup)
    const mainTeacherId = userMap.get(normalizeName(row.teacher))!
    const userBids = membersData.find((m) => normalizeName(m.name) === normalizeName(row.teacher))

    await prisma.teacherGroup.create({
      data: {
        teacherId: mainTeacherId,
        groupId: group.id,
        organizationId: ORG_ID,
        bid: userBids?.bidForLesson || 0,
        bonusPerStudent: userBids?.bonusPerStudent || 0,
      },
    })

    if (row.substituteTeacher) {
      const subTeacherId = userMap.get(normalizeName(row.substituteTeacher))
      if (subTeacherId) {
        const subBids = membersData.find(
          (m) => normalizeName(m.name) === normalizeName(row.substituteTeacher)
        )
        await prisma.teacherGroup.create({
          data: {
            teacherId: subTeacherId,
            groupId: group.id,
            organizationId: ORG_ID,
            bid: subBids?.bidForLesson || 0,
            bonusPerStudent: subBids?.bonusPerStudent || 0,
          },
        })
      }
    }

    // ── Генерация уроков (Lesson + TeacherLesson) ──────────────────────
    const scheduleDaysMap = new Map(schedules.map((s) => [s.dayOfWeek, s.time]))
    const lessons: Array<{ date: Date; time: string }> = []
    const currentDate = new Date(startDate)
    const maxIterations = lessonCount * 7 + 7

    for (let iter = 0; iter < maxIterations && lessons.length < lessonCount; iter++) {
      const time = scheduleDaysMap.get(currentDate.getDay())
      if (time) {
        lessons.push({ date: fromZonedTime(new Date(currentDate), TIMEZONE), time })
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    const createdLessons = await prisma.lesson.createManyAndReturn({
      data: lessons.map((l) => ({
        date: l.date,
        time: l.time,
        status: 'ACTIVE' as const,
        groupId: group.id,
        organizationId: ORG_ID,
      })),
    })

    // TeacherLesson
    if (createdLessons.length > 0) {
      await prisma.teacherLesson.createMany({
        data: createdLessons.map((lesson) => ({
          teacherId: mainTeacherId,
          lessonId: lesson.id,
          organizationId: ORG_ID,
          bid: userBids?.bidForLesson || 0,
          bonusPerStudent: userBids?.bonusPerStudent || 0,
        })),
      })
    }

    groupMap.set(normalizeName(groupName), group.id)
    lessonsByGroup.set(
      group.id,
      createdLessons.map((l) => ({ id: l.id, organizationId: l.organizationId }))
    )

    const scheduleStr = schedules
      .map((s) => `${['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][s.dayOfWeek]} ${s.time}`)
      .join(', ')
    console.log(
      `  + "${groupName}" (id=${group.id}, ${groupType}, [${scheduleStr}], уроков=${createdLessons.length})`
    )
  }
  console.log(`✓ Групп: ${groupMap.size}\n`)

  // ═══ 5. Студенты (Student + StudentGroup + Attendance) ═════════════════════
  console.log('--- 5. Импорт студентов ---')
  let studentCount = 0
  let studentGroupCount = 0
  let attendanceCount = 0
  const usedLogins = new Set<string>()

  // Дедупликация: объединяем строки одного и того же студента (по имени+фамилии)
  interface MergedStudent {
    firstName: string
    lastName: string
    birthDate: string
    parentsName: string
    parentsPhone: string
    groups: Set<string>
    lessonsBalance: number
    totalPayments: number
    url: string
  }

  const mergedStudentsMap = new Map<string, MergedStudent>()

  for (const row of studentsData) {
    const firstName = row.firstName.trim()
    const lastName = row.lastName.trim()
    const birthDateRaw = row.birthDate?.trim() || ''
    const key = `${normalizeName(firstName)}::${normalizeName(lastName)}::${birthDateRaw}`

    const existing = mergedStudentsMap.get(key)
    const rowGroups = row.groups
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean)

    if (existing) {
      // Мержим группы
      for (const g of rowGroups) existing.groups.add(g)
      // Берём непустые значения, если в текущей записи они заполнены
      if (!existing.parentsName && row.parentsName) existing.parentsName = row.parentsName
      if (!existing.parentsPhone && row.parentsPhone) existing.parentsPhone = row.parentsPhone
      if (!existing.url && row.url) existing.url = row.url
      if (!existing.birthDate && row.birthDate) existing.birthDate = row.birthDate
      // Суммируем балансы
      existing.lessonsBalance += row.lessonsBalance || 0
      existing.totalPayments += row.totalPayments || 0

      console.log(`  ℹ Дубликат студента "${firstName} ${lastName}" — группы объединены`)
    } else {
      mergedStudentsMap.set(key, {
        firstName,
        lastName,
        birthDate: row.birthDate,
        parentsName: row.parentsName || '',
        parentsPhone: row.parentsPhone || '',
        groups: new Set(rowGroups),
        lessonsBalance: row.lessonsBalance || 0,
        totalPayments: row.totalPayments || 0,
        url: row.url || '',
      })
    }
  }

  console.log(
    `  Уникальных студентов: ${mergedStudentsMap.size} (из ${studentsData.length} строк)\n`
  )

  for (const merged of mergedStudentsMap.values()) {
    const { firstName, lastName } = merged

    // Генерация уникального логина
    let login = generateLogin(firstName, lastName)
    if (usedLogins.has(login)) {
      let counter = 2
      while (usedLogins.has(`${login}${counter}`)) counter++
      login = `${login}${counter}`
    }
    usedLogins.add(login)

    const password = generatePassword()
    const birthDate = merged.birthDate ? parseDate(merged.birthDate) : DEFAULT_BIRTH_DATE
    const age = calculateAge(birthDate)

    if (!merged.birthDate) {
      console.warn(
        `  ⚠ Дата рождения не указана для "${firstName} ${lastName}" — установлено 01.01.1900`
      )
    }

    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        login,
        password,
        age,
        birthDate,
        parentsName: merged.parentsName || null,
        parentsPhone: merged.parentsPhone || null,
        url: merged.url || null,
        lessonsBalance: merged.lessonsBalance,
        totalLessons: merged.lessonsBalance,
        totalPayments: merged.totalPayments,
        organizationId: ORG_ID,
      },
    })
    studentCount++

    // Привязка к группам
    for (const gName of merged.groups) {
      const groupId = groupMap.get(normalizeName(gName))
      if (!groupId) {
        console.warn(`  ⚠ Группа "${gName}" не найдена для студента "${firstName} ${lastName}"`)
        continue
      }

      try {
        await prisma.studentGroup.create({
          data: {
            studentId: student.id,
            groupId,
            organizationId: ORG_ID,
            status: 'ACTIVE',
          },
        })
        studentGroupCount++

        // Attendance для всех уроков группы
        const groupLessons = lessonsByGroup.get(groupId) || []
        if (groupLessons.length > 0) {
          const result = await prisma.attendance.createMany({
            data: groupLessons.map((lesson) => ({
              organizationId: lesson.organizationId,
              lessonId: lesson.id,
              studentId: student.id,
              comment: '',
              status: 'UNSPECIFIED' as const,
            })),
            skipDuplicates: true,
          })
          attendanceCount += result.count
        }
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e)
        if (errMsg.includes('Unique constraint')) {
          console.warn(`  ⚠ Дублирующая привязка: ${firstName} ${lastName} → ${gName}`)
        } else {
          throw e
        }
      }
    }

    if (studentCount % 10 === 0) {
      console.log(`  ... обработано ${studentCount} студентов`)
    }
  }

  console.log(`✓ Студентов: ${studentCount}`)
  console.log(`✓ Привязок студент→группа: ${studentGroupCount}`)
  console.log(`✓ Записей посещаемости: ${attendanceCount}\n`)

  // ═══ Итоги ════════════════════════════════════════════════════════════════
  console.log('╔══════════════════════════════════════╗')
  console.log('║       ИМПОРТ ЗАВЕРШЁН УСПЕШНО        ║')
  console.log('╠══════════════════════════════════════╣')
  console.log(`║  Организация:  ${org.name.padEnd(20)}  ║`)
  console.log(`║  Курсов:       ${String(courseMap.size).padEnd(20)}  ║`)
  console.log(`║  Локаций:      ${String(locationMap.size).padEnd(20)}  ║`)
  console.log(`║  Сотрудников:  ${String(userMap.size).padEnd(20)}  ║`)
  console.log(`║  Групп:        ${String(groupMap.size).padEnd(20)}  ║`)
  console.log(`║  Студентов:    ${String(studentCount).padEnd(20)}  ║`)
  console.log(`║  Привязок:     ${String(studentGroupCount).padEnd(20)}  ║`)
  console.log(`║  Посещаемость: ${String(attendanceCount).padEnd(20)}  ║`)
  console.log('╚══════════════════════════════════════╝')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('\n❌ Ошибка импорта:', e)
  await prisma.$disconnect()
  process.exit(1)
})
