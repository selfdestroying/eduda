'use server'

import prisma from '@/src/lib/prisma'
import { hashPassword } from 'better-auth/crypto'
import { startOfDay } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { revalidatePath } from 'next/cache'
import { parseCSV } from '../lib/csv-parser'
import {
  validateCSVData,
  validateCSVHeaders,
  type CSVTableType,
  type ValidationResult,
} from '../lib/csv-validation'
import { DaysOfWeek } from '../lib/utils'

export type ImportValidationResponse = {
  success: boolean
  tableType: CSVTableType
  validation: ValidationResult
  headerError?: string
  preview?: Record<string, string>[]
}

export type ImportExecutionResponse = {
  success: boolean
  message: string
  createdCount: number
}

/**
 * Валидация CSV-данных без импорта.
 */
export async function validateCSVImport(
  csvText: string,
  tableType: CSVTableType
): Promise<ImportValidationResponse> {
  const rows = parseCSV(csvText)
  if (rows.length === 0) {
    return {
      success: false,
      tableType,
      validation: {
        valid: false,
        errors: [{ row: 0, column: '-', message: 'Файл пуст' }],
        rowCount: 0,
      },
    }
  }

  const headers = Object.keys(rows[0])
  const headerCheck = validateCSVHeaders(headers, tableType)
  if (!headerCheck.valid) {
    return {
      success: false,
      tableType,
      validation: { valid: false, errors: [], rowCount: rows.length },
      headerError: `Отсутствуют колонки: ${headerCheck.missing.join(', ')}`,
    }
  }

  const validation = validateCSVData(rows, tableType)
  return {
    success: validation.valid,
    tableType,
    validation,
    preview: rows.slice(0, 5),
  }
}

/**
 * Импорт CSV-данных в БД для конкретной организации.
 */
export async function executeCSVImport(
  csvText: string,
  tableType: CSVTableType,
  organizationId: number
): Promise<ImportExecutionResponse> {
  const rows = parseCSV(csvText)
  const validation = validateCSVData(rows, tableType)
  if (!validation.valid) {
    return { success: false, message: 'Данные не прошли валидацию', createdCount: 0 }
  }

  try {
    let createdCount = 0

    switch (tableType) {
      case 'courses':
        createdCount = await importCourses(rows, organizationId)
        break
      case 'locations':
        createdCount = await importLocations(rows, organizationId)
        break
      case 'members':
        createdCount = await importMembers(rows, organizationId)
        break
      case 'groups':
        createdCount = await importGroups(rows, organizationId)
        break
      case 'students':
        createdCount = await importStudents(rows, organizationId)
        break
    }

    revalidatePath('/admin')
    revalidatePath('/dashboard')

    return {
      success: true,
      message: `Успешно импортировано: ${createdCount} записей`,
      createdCount,
    }
  } catch (error) {
    console.error('Import error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Ошибка при импорте',
      createdCount: 0,
    }
  }
}

// ─── Импорт курсов ──────────────────────────────────────────────

async function importCourses(rows: Record<string, string>[], organizationId: number) {
  const data = rows.map((row) => ({
    name: row['Название Курса'],
    organizationId,
  }))

  const result = await prisma.course.createMany({ data, skipDuplicates: true })
  return result.count
}

// ─── Импорт локаций ──────────────────────────────────────────────

async function importLocations(rows: Record<string, string>[], organizationId: number) {
  const data = rows.map((row) => ({
    name: row['Локация (кабинет)'],
    organizationId,
  }))

  const result = await prisma.location.createMany({ data, skipDuplicates: true })
  return result.count
}

// ─── Импорт преподавателей ──────────────────────────────────────

async function importMembers(rows: Record<string, string>[], organizationId: number) {
  let count = 0

  for (const row of rows) {
    const fullName = row['ФИО Преподавателя']
    const parts = fullName.split(' ')
    const lastName = parts[0] ?? ''
    const firstName = parts.slice(1).join(' ') || lastName
    const email = row['Email (Логин)']
    const role = row['Роль']?.toLowerCase() ?? 'member'

    const existingUser = await prisma.user.findFirst({ where: { email } })

    let userId: number
    if (existingUser) {
      userId = existingUser.id
    } else {
      const hashedPassword = await hashPassword('Sunaza.45')
      const newUser = await prisma.user.create({
        data: {
          firstName,
          lastName,
          name: fullName,
          email,
          emailVerified: false,
          accounts: {
            create: {
              providerId: 'credential',
              accountId: email,
              password: hashedPassword,
            },
          },
        },
      })
      userId = newUser.id
    }

    const existingMember = await prisma.member.findFirst({
      where: { userId, organizationId },
    })

    if (!existingMember) {
      await prisma.member.create({
        data: {
          userId,
          organizationId,
          role,
          createdAt: new Date(),
        },
      })
      count++
    }
  }

  return count
}

// ─── Импорт групп ───────────────────────────────────────────────

function parseDayOfWeek(dayStr: string): number {
  const day = dayStr.toLowerCase()
  const idx = DaysOfWeek.full.findIndex((d) => d.toLowerCase() === day)
  return idx >= 0 ? idx : 0
}

async function importGroups(rows: Record<string, string>[], organizationId: number) {
  let count = 0

  const courses = await prisma.course.findMany({ where: { organizationId } })
  const locations = await prisma.location.findMany({ where: { organizationId } })
  const members = await prisma.member.findMany({
    where: { organizationId },
    include: { user: true },
  })

  // Создаём дефолтный курс, если курсов нет
  let defaultCourse = courses[0]
  if (!defaultCourse) {
    defaultCourse = await prisma.course.create({
      data: { name: 'Основной курс', organizationId },
    })
  }

  for (const row of rows) {
    const name = row['Название Группы']
    const dayOfWeek = parseDayOfWeek(row['День недели'])
    const time = row['Время начала']
    const startDate = fromZonedTime(startOfDay(new Date(row['Дата Старта'])), 'Europe/Moscow')
    const lessonCount = parseInt(row['Количество уроков']) || 24

    const locationName = row['Локация']?.trim()
    const location = locationName
      ? locations.find((l) => l.name.toLowerCase() === locationName.toLowerCase())
      : null

    const maxStudents = location ? 12 : 12

    // Поиск курса по имени группы (если курс есть в названии)
    const courseId = defaultCourse.id

    const lessons = Array.from({ length: lessonCount ?? 0 }).map((_, index) => {
      const date = new Date(startDate)
      date.setDate(date.getDate() + index * 7)
      return { date, time, organizationId }
    })

    // Создаём группу с уроками
    const group = await prisma.group.create({
      data: {
        name,
        organizationId,
        courseId,
        type: 'GROUP',
        startDate,
        dayOfWeek,
        time,
        maxStudents,
        lessonCount,
        locationId: location?.id ?? null,
        lessons: {
          createMany: {
            data: lessons,
          },
        },
      },
      include: { lessons: true },
    })

    // Привязка основного преподавателя
    const mainTeacherName = row['Преподаватель (Основной)']?.trim()
    if (mainTeacherName) {
      const member = members.find(
        (m) => m.user.name.toLowerCase() === mainTeacherName.toLowerCase()
      )
      if (member) {
        await prisma.teacherGroup.create({
          data: {
            teacherId: member.userId,
            groupId: group.id,
            organizationId,
            bid: member.user.bidForLesson,
          },
        })
        // Привязка к урокам
        for (const lesson of group.lessons) {
          await prisma.teacherLesson.create({
            data: {
              teacherId: member.userId,
              lessonId: lesson.id,
              organizationId,
              bid: member.user.bidForLesson,
            },
          })
        }
      }
    }

    count++
  }

  return count
}

function generateLessonDates(
  startDate: Date,
  dayOfWeek: number,
  lessonCount: number,
  time: string | null
): { date: Date; time: string | null }[] {
  const dates: { date: Date; time: string | null }[] = []
  const current = new Date(startDate)

  // Корректируем на нужный день недели
  const currentDay = current.getDay()
  let diff = (dayOfWeek - currentDay + 7) % 7
  if (diff === 0 && dates.length === 0) diff = 0
  current.setDate(current.getDate() + diff)

  for (let i = 0; i < lessonCount; i++) {
    dates.push({
      date: new Date(current),
      time,
    })
    current.setDate(current.getDate() + 7)
  }

  return dates
}

// ─── Импорт учеников ────────────────────────────────────────────

async function importStudents(rows: Record<string, string>[], organizationId: number) {
  let count = 0

  const groups = await prisma.group.findMany({ where: { organizationId } })

  for (const row of rows) {
    const fullName = row['ФИО Ученика']
    const parts = fullName.split(' ')
    const lastName = parts[0] ?? ''
    const firstName = parts.slice(1).join(' ') || lastName
    const age = parseInt(row['Возраст ученика']) || 10
    const parentsName = row['ФИО Родителя'] || null
    const parentsPhone = row['Телефон'] || null
    const lessonsBalance = parseInt(row['Текущий Баланс (Занятий)']) || 0
    const birthDateStr = row['Дата рождения (Опционально)']
    const birthDate = birthDateStr ? new Date(birthDateStr) : null

    // Генерируем логин/пароль
    const login = transliterate(lastName).toLowerCase() + '_' + Math.floor(Math.random() * 10000)
    const password = generatePassword()

    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        login,
        password,
        age,
        birthDate,
        parentsName,
        parentsPhone,
        lessonsBalance,
        organizationId,
      },
    })

    // Привязка к группам
    const groupNames = row['Названия Групп']?.split(',').map((g) => g.trim()) ?? []
    for (const groupName of groupNames) {
      if (!groupName) continue
      const group = groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase())
      if (group) {
        try {
          await prisma.studentGroup.create({
            data: {
              studentId: student.id,
              groupId: group.id,
              organizationId,
              status: 'ACTIVE',
            },
          })
        } catch {
          // Дубликат связи — пропускаем
          console.warn(`Студент ${fullName} уже привязан к группе ${group.name}`)
        }
      }
    }

    count++
  }

  return count
}

function transliterate(text: string): string {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'yo',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  }
  return text
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
}

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let pwd = ''
  for (let i = 0; i < 8; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  return pwd
}
