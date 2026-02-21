import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from 'better-auth/crypto'
import { parse } from 'csv-parse/sync'
import { fromZonedTime } from 'date-fns-tz'
import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { transliterate } from 'transliteration'
import { PrismaClient } from './generated/client'

// ─── Config ──────────────────────────────────────────────────────────────────

const ORG_ID = 2

// ─── Prisma client setup ────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readCSV<T extends Record<string, string>>(filename: string): T[] {
  const filePath = resolve(__dirname, '..', filename)
  const content = readFileSync(filePath, 'utf-8')
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as T[]
}

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
  if (t.startsWith('группа') || t.startsWith('группы') || t.startsWith('сплит')) return 'GROUP'
  if (t.startsWith('индив')) return 'INDIVIDUAL'
  throw new Error(`Неизвестный тип группы: "${raw}"`)
}

function parseDate(raw: string): Date {
  // Формат DD.MM.YYYY
  const [day, month, year] = raw.split('.')
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
}

function parseRoleToMemberRole(raw: string): string {
  const r = raw.trim().toLowerCase()
  if (r === 'преподаватель') return 'teacher'
  if (r === 'менеджер') return 'manager'
  if (r === 'владелец') return 'owner'
  throw new Error(`Неизвестная роль: "${raw}"`)
}

function generateLogin(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const lastName = parts[0] || 'user'
  const firstName = parts.slice(1).join('.') || 'x'
  return transliterate(`${firstName}.${lastName}`)
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
}

function generatePassword(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** Нормализуем название курса для сопоставления: убираем пробелы, приводим к lowercase */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Парсим день-пары типа "ВТ-ЧТ", "ПН-СР", "СР-ПТ" */
function parseDayPairSuffix(raw: string): string | null {
  const match = raw.match(/\b(ПН|ВТ|СР|ЧТ|ПТ|СБ|ВС)-(ПН|ВТ|СР|ЧТ|ПТ|СБ|ВС)\b/i)
  return match ? match[0].toUpperCase() : null
}

/** Убираем суффиксы вроде "(Пн 18:00)" и "ВТ-ЧТ" для получения чистого имени курса */
function cleanGroupNameForCourseMatch(groupName: string): string {
  let cleaned = groupName.trim()
  // Убираем содержимое в скобках: "Питон Старт (Пн 18:00)" → "Питон Старт"
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/, '')
  // Убираем суффиксы дня типа "ВТ-ЧТ", "ПН-СР", "СР-ПТ"
  cleaned = cleaned.replace(/\s+(ПН|ВТ|СР|ЧТ|ПТ|СБ|ВС)-(ПН|ВТ|СР|ЧТ|ПТ|СБ|ВС)\s*$/i, '')
  return cleaned.trim()
}

// ─── CSV Types ───────────────────────────────────────────────────────────────

interface LocationCSV extends Record<string, string> {
  'Локация (кабинет)': string
  'Максимум посадочных мест': string
}

interface CourseCSV extends Record<string, string> {
  'Название Курса': string
}

interface MemberCSV extends Record<string, string> {
  'ФИО Преподавателя': string
  'Email (Логин)': string
  Роль: string
}

interface GroupCSV extends Record<string, string> {
  Курс: string
  Тип: string
  'Преподаватель (Основной)': string
  'Преподаватель (Запасной)': string
  'День недели': string
  'Время начала': string
  Локация: string
  'Длительность (мин)': string
  'Дата Старта': string
  'Количество уроков': string
}

interface StudentCSV extends Record<string, string> {
  'ФИО Ученика': string
  'ФИО Родителя': string
  Телефон: string
  'Названия Групп': string
  'Текущий Баланс (Занятий)': string
  'Текущий Баланс (Рублей/Долга)': string
  'Возраст ученика': string
  'Дата рождения (Опционально)': string
  Комментарий: string
}

// ─── Main import function ────────────────────────────────────────────────────

async function main() {
  console.log('=== Начинаем импорт CSV данных ===\n')

  // Проверяем существование организации, создаём если нет
  let org = await prisma.organization.findUnique({ where: { id: ORG_ID } })
  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: ORG_ID,
        name: 'Тестовая организация',
        slug: 'test-org',
      },
    })
    console.log(`✓ Организация создана: "${org.name}" (id=${ORG_ID})`)
  } else {
    console.log(`✓ Организация найдена: "${org.name}" (id=${ORG_ID})`)
  }
  console.log()

  // ═══ 1. Локации ═══════════════════════════════════════════════════════════
  console.log('--- 1. Импорт локаций ---')
  const locationsCSV = readCSV<LocationCSV>('locations.csv')

  const locationMap = new Map<string, { id: number; maxSeats: number }>()

  for (const row of locationsCSV) {
    const name = row['Локация (кабинет)'].trim()
    const maxSeats = parseInt(row['Максимум посадочных мест']) || 10

    const location = await prisma.location.create({
      data: { name, organizationId: ORG_ID },
    })
    locationMap.set(normalizeName(name), { id: location.id, maxSeats })
    console.log(`  + Локация: "${name}" (id=${location.id}, мест=${maxSeats})`)
  }
  console.log(`✓ Локаций импортировано: ${locationMap.size}\n`)

  // ═══ 2. Курсы ═════════════════════════════════════════════════════════════
  console.log('--- 2. Импорт курсов ---')
  const coursesCSV = readCSV<CourseCSV>('courses.csv')

  const courseMap = new Map<string, number>()

  for (const row of coursesCSV) {
    const name = row['Название Курса'].trim()
    const course = await prisma.course.create({
      data: { name, organizationId: ORG_ID },
    })
    courseMap.set(normalizeName(name), course.id)
    console.log(`  + Курс: "${name}" (id=${course.id})`)
  }
  console.log(`✓ Курсов импортировано: ${courseMap.size}\n`)

  // ═══ 3. Пользователи (User + Account + Member) ═══════════════════════════
  console.log('--- 3. Импорт пользователей ---')
  const membersCSV = readCSV<MemberCSV>('members.csv')

  const userMap = new Map<string, number>() // ФИО → userId

  for (const row of membersCSV) {
    const name = row['ФИО Преподавателя'].trim()
    const email = row['Email (Логин)'].trim()
    const role = parseRoleToMemberRole(row['Роль'])

    const user = await prisma.user.create({
      data: {
        name,
        email,
        bidForLesson: 0,
        bidForIndividual: 0,
        bonusPerStudent: 0,
      },
    })

    const hashedPassword = await hashPassword('12345')
    await prisma.account.create({
      data: {
        accountId: user.id.toString(),
        providerId: 'credential',
        userId: user.id,
        password: hashedPassword,
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
    console.log(`  + Пользователь: "${name}" (id=${user.id}, email=${email}, role=${role})`)
  }
  console.log(`✓ Пользователей импортировано: ${userMap.size}\n`)

  // ═══ 4. Группы (Group + GroupSchedule + TeacherGroup) ═════════════════════
  console.log('--- 4. Импорт групп ---')
  const groupsCSV = readCSV<GroupCSV>('groups.csv')

  // Группируем CSV-строки по курсу для объединения многодневных групп
  // (Джиу джитсу — 2 строки, Армрестлинг — 2 строки)
  const groupedByCourseName = new Map<string, GroupCSV[]>()
  for (const row of groupsCSV) {
    const courseName = normalizeName(row['Курс'])
    if (!groupedByCourseName.has(courseName)) {
      groupedByCourseName.set(courseName, [])
    }
    groupedByCourseName.get(courseName)!.push(row)
  }

  // courseNormalized → groupId (для привязки студентов)
  const groupByCourse = new Map<string, number>()
  // groupId → массив lessonId (для создания Attendance при привязке студентов)
  const lessonsByGroup = new Map<number, Array<{ id: number; organizationId: number }>>()

  for (const [courseName, rows] of groupedByCourseName) {
    const firstRow = rows[0]

    // Находим курс
    let courseId = courseMap.get(courseName)
    if (!courseId) {
      // Пробуем startsWith match (для "армрестлинг" → "армрестлинг пн-ср")
      for (const [cName, cId] of courseMap) {
        if (cName.startsWith(courseName) || courseName.startsWith(cName)) {
          courseId = cId
          break
        }
      }
    }
    if (!courseId) {
      console.warn(`  ⚠ Курс не найден для "${courseName}", пропускаем`)
      continue
    }

    // Находим локацию
    const locationName = normalizeName(firstRow['Локация'])
    const locationData = locationMap.get(locationName)
    if (!locationData) {
      console.warn(`  ⚠ Локация не найдена для "${firstRow['Локация']}", пропускаем`)
      continue
    }

    // Собираем все расписания из всех строк
    const schedules: Array<{ dayOfWeek: number; time: string }> = []
    for (const row of rows) {
      const rawDays = row['День недели']
      const time = row['Время начала'].trim()
      // Дни могут быть через запятую: "Вторник, Четверг"
      const dayParts = rawDays.split(',').map((d) => d.trim())
      for (const dayPart of dayParts) {
        if (!dayPart) continue
        schedules.push({ dayOfWeek: parseDayOfWeek(dayPart), time })
      }
    }

    // Primary day = первый день расписания
    const primarySchedule = schedules[0]
    const startDate = parseDate(firstRow['Дата Старта'])
    const lessonCount = parseInt(firstRow['Количество уроков']) || 30
    const groupType = parseGroupType(firstRow['Тип'])

    const group = await prisma.group.create({
      data: {
        startDate,
        dayOfWeek: primarySchedule.dayOfWeek,
        time: primarySchedule.time,
        maxStudents: locationData.maxSeats,
        type: groupType,
        organizationId: ORG_ID,
        courseId,
        locationId: locationData.id,
      },
    })

    // Создаём GroupSchedule записи
    await prisma.groupSchedule.createMany({
      data: schedules.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        time: s.time,
        groupId: group.id,
        organizationId: ORG_ID,
      })),
      skipDuplicates: true,
    })

    // Привязываем преподавателей (TeacherGroup)
    const mainTeacherName = normalizeName(firstRow['Преподаватель (Основной)'])
    const mainTeacherId = userMap.get(mainTeacherName)
    if (mainTeacherId) {
      await prisma.teacherGroup.create({
        data: {
          teacherId: mainTeacherId,
          groupId: group.id,
          organizationId: ORG_ID,
          bid: 0,
          bonusPerStudent: 0,
        },
      })
    } else {
      console.warn(
        `  ⚠ Основной преподаватель не найден: "${firstRow['Преподаватель (Основной)']}"`
      )
    }

    const subTeacherName = firstRow['Преподаватель (Запасной)']?.trim()
    if (subTeacherName) {
      const subTeacherId = userMap.get(normalizeName(subTeacherName))
      if (subTeacherId) {
        await prisma.teacherGroup.create({
          data: {
            teacherId: subTeacherId,
            groupId: group.id,
            organizationId: ORG_ID,
            bid: 0,
            bonusPerStudent: 0,
          },
        })
      } else {
        console.warn(`  ⚠ Запасной преподаватель не найден: "${subTeacherName}"`)
      }
    }

    // ─── Генерация уроков (Lesson + TeacherLesson) ────────────────────────
    const scheduleDaysMap = new Map(schedules.map((s) => [s.dayOfWeek, s.time]))
    const lessons: Array<{ date: Date; time: string }> = []
    const currentDate = new Date(startDate)
    const maxIterations = lessonCount * 7 + 7

    for (let i = 0; i < maxIterations && lessons.length < lessonCount; i++) {
      const time = scheduleDaysMap.get(currentDate.getDay())
      if (time) {
        lessons.push({ date: fromZonedTime(new Date(currentDate), 'Europe/Moscow'), time })
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Создаём уроки пакетами
    const createdLessons = await prisma.lesson.createManyAndReturn({
      data: lessons.map((l) => ({
        date: l.date,
        time: l.time,
        status: 'ACTIVE' as const,
        groupId: group.id,
        organizationId: ORG_ID,
      })),
    })

    // Привязываем основного преподавателя к урокам
    if (mainTeacherId && createdLessons.length > 0) {
      await prisma.teacherLesson.createMany({
        data: createdLessons.map((lesson) => ({
          teacherId: mainTeacherId,
          lessonId: lesson.id,
          organizationId: ORG_ID,
          bid: 0,
          bonusPerStudent: 0,
        })),
      })
    }

    // Сохраняем маппинг курс → группа и уроки
    groupByCourse.set(courseName, group.id)
    lessonsByGroup.set(
      group.id,
      createdLessons.map((l) => ({ id: l.id, organizationId: l.organizationId }))
    )

    const scheduleStr = schedules.map((s) => `${s.dayOfWeek}@${s.time}`).join(', ')
    console.log(
      `  + Группа: "${firstRow['Курс'].trim()}" (id=${group.id}, тип=${groupType}, расписание=[${scheduleStr}], уроков=${createdLessons.length})`
    )
  }
  console.log(`✓ Групп импортировано: ${groupByCourse.size}\n`)

  // ═══ 5. Студенты (Student + StudentGroup) ═════════════════════════════════
  console.log('--- 5. Импорт студентов ---')
  const studentsCSV = readCSV<StudentCSV>('students.csv')

  let studentCount = 0
  let studentGroupCount = 0
  let attendanceCount = 0
  const usedLogins = new Set<string>()

  for (const row of studentsCSV) {
    const fullName = row['ФИО Ученика'].trim()
    const parts = fullName.split(/\s+/)
    const lastName = parts[0] || 'Unknown'
    const firstName = parts.slice(1).join(' ') || 'X'

    // Генерация уникального логина
    let login = generateLogin(fullName)
    if (usedLogins.has(login)) {
      let counter = 2
      while (usedLogins.has(`${login}${counter}`)) counter++
      login = `${login}${counter}`
    }
    usedLogins.add(login)

    const password = generatePassword()
    const age = parseInt(row['Возраст ученика']) || 13
    const lessonsBalance = parseInt(row['Текущий Баланс (Занятий)']) || 0
    const totalPayments = parseInt(row['Текущий Баланс (Рублей/Долга)']) || 0

    // birthDate из CSV или генерируем примерную дату из возраста
    let birthDate: Date
    const rawBirthDate = row['Дата рождения (Опционально)']?.trim()
    if (rawBirthDate) {
      birthDate = parseDate(rawBirthDate)
    } else {
      // Примерная дата рождения на основе возраста
      birthDate = new Date()
      birthDate.setFullYear(birthDate.getFullYear() - age)
    }

    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        login,
        password,
        age,
        birthDate,
        parentsName: row['ФИО Родителя']?.trim() || null,
        parentsPhone: row['Телефон']?.trim() || null,
        lessonsBalance,
        totalPayments,
        organizationId: ORG_ID,
      },
    })
    studentCount++

    // Привязка к группам
    const groupNames = row['Названия Групп']?.trim()
    if (groupNames) {
      // Разделяем по запятой, но учитываем что csv-parse уже обработал кавычки
      const groupEntries = groupNames
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean)

      for (const groupEntry of groupEntries) {
        const cleanedName = cleanGroupNameForCourseMatch(groupEntry)
        const normalizedName = normalizeName(cleanedName)

        // Ищем группу: сначала точное совпадение, потом startsWith
        let groupId = groupByCourse.get(normalizedName)
        if (!groupId) {
          for (const [gName, gId] of groupByCourse) {
            if (gName.startsWith(normalizedName) || normalizedName.startsWith(gName)) {
              groupId = gId
              break
            }
          }
        }

        if (groupId) {
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

            // Создаём Attendance записи для всех уроков группы
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
            // Пропускаем дубликаты (composite PK)
            if (errMsg.includes('Unique constraint')) {
              console.warn(`  ⚠ Дублирующая привязка: студент ${student.id} → группа ${groupId}`)
            } else {
              throw e
            }
          }
        } else {
          console.warn(`  ⚠ Группа не найдена для "${groupEntry}" (очищено: "${cleanedName}")`)
        }
      }
    }

    if (studentCount % 10 === 0) {
      console.log(`  ... обработано ${studentCount} студентов`)
    }
  }

  console.log(`✓ Студентов импортировано: ${studentCount}`)
  console.log(`✓ Привязок студент-группа: ${studentGroupCount}`)
  console.log(`✓ Записей посещаемости: ${attendanceCount}\n`)

  // ═══ Итоги ════════════════════════════════════════════════════════════════
  console.log('=== Импорт завершён ===')
  console.log(`  Локаций: ${locationMap.size}`)
  console.log(`  Курсов: ${courseMap.size}`)
  console.log(`  Пользователей: ${userMap.size}`)
  console.log(`  Групп: ${groupByCourse.size}`)
  console.log(`  Студентов: ${studentCount}`)
  console.log(`  Привязок студент-группа: ${studentGroupCount}`)
  console.log(`  Записей посещаемости: ${attendanceCount}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Ошибка импорта:', e)
  prisma.$disconnect()
  process.exit(1)
})
