/**
 * Идемпотентная сид-фабрика демо-организации.
 *
 * `seedDemoOrg()` полностью пересоздаёт организацию `slug: "demo"` с
 * реалистичными русскими данными. Используется и для первичного посева, и для
 * периодического сброса (см. `src/app/api/demo/reset/route.ts`).
 *
 * Всё завязано на одну общую демо-орг — изоляция от реальных школ обеспечивается
 * существующим scoping'ом по `organizationId`. Удаление орг каскадно чистит все
 * дочерние данные (`onDelete: Cascade`), поэтому «снести и создать заново» —
 * безопасная операция.
 *
 * Даты бизнеса берутся по Europe/Moscow (`todayYmdInTz`) и хранятся в date-only
 * колонках как строки `YYYY-MM-DD`. Внутри сида арифметика идёт по UTC-полуночи
 * (`getUTC*`), а на границе записи в БД дата приводится к строке через `ymd()`.
 */
import { Prisma } from '@/prisma/generated/client'
import prisma from '@/src/lib/db/prisma'
import { DEFAULT_TZ, todayYmdInTz } from '@/src/lib/timezone'
import { auth } from '@/src/lib/auth/server'
import {
  DEMO_EMAILS,
  DEMO_ORG_NAME,
  DEMO_ROLES,
  DEMO_SLUG,
  DEMO_USERS,
  demoPassword,
  type DemoRole,
} from './constants'

// ─── Детерминированный ГПСЧ (mulberry32) ───────────────────────────────
// Стабильные данные между пересевами приятны, но не обязательны.
function makeRng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = makeRng(20240714)
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!
const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1))

// ─── Дата-хелперы ──────────────────────────────────────────────────────
// Арифметика — по UTC-полуночи; в БД date-only колонки пишутся строкой.
function addUTCDays(d: Date, n: number): Date {
  const r = new Date(d.getTime())
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

/** UTC-полночь Date → строка `YYYY-MM-DD` для date-only колонок. */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Уроки по расписанию в окне [from; to] включительно. */
function generateLessons(
  schedule: { dayOfWeek: number; time: string }[],
  from: Date,
  to: Date,
  organizationId: number,
) {
  const map = new Map(schedule.map((s) => [s.dayOfWeek, s.time]))
  const out: { date: string; time: string; organizationId: number }[] = []
  const cur = new Date(from.getTime())
  while (cur.getTime() <= to.getTime()) {
    const time = map.get(cur.getUTCDay())
    if (time) out.push({ date: ymd(cur), time, organizationId })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

// ─── Пулы русских данных ───────────────────────────────────────────────
const FIRST_NAMES = [
  'Александр',
  'Дмитрий',
  'Максим',
  'Егор',
  'Артём',
  'Никита',
  'Иван',
  'Михаил',
  'Софья',
  'Мария',
  'Анна',
  'Виктория',
  'Полина',
  'Алиса',
  'Ева',
  'Дарья',
  'Кирилл',
  'Тимофей',
  'Матвей',
  'Лев',
  'Милана',
  'Ксения',
  'Варвара',
  'Арина',
]
const LAST_NAMES = [
  'Иванов',
  'Петров',
  'Смирнов',
  'Кузнецов',
  'Попов',
  'Соколов',
  'Лебедев',
  'Козлов',
  'Новиков',
  'Морозов',
  'Волков',
  'Фёдоров',
  'Михайлов',
  'Никитин',
]
const PARENT_FIRST = ['Ольга', 'Елена', 'Наталья', 'Сергей', 'Андрей', 'Татьяна']

/** Женское имя → женская фамилия (грубая эвристика по окончанию). */
const feminine = (first: string) => /[ая]$/.test(first)
const lastNameFor = (first: string) => {
  const base = pick(LAST_NAMES)
  return feminine(first) ? `${base}а` : base
}

interface GroupDef {
  course: string
  location: number // индекс локации
  schedule: { dayOfWeek: number; time: string }[]
}
// Sun=0 Mon=1 Tue=2 Wed=3 Thu=4 Fri=5 Sat=6
const GROUP_DEFS: GroupDef[] = [
  {
    course: 'Английский язык',
    location: 0,
    schedule: [
      { dayOfWeek: 1, time: '16:00' },
      { dayOfWeek: 3, time: '16:00' },
    ],
  },
  {
    course: 'Математика',
    location: 0,
    schedule: [
      { dayOfWeek: 2, time: '17:30' },
      { dayOfWeek: 4, time: '17:30' },
    ],
  },
  { course: 'Программирование', location: 1, schedule: [{ dayOfWeek: 6, time: '11:00' }] },
  {
    course: 'Подготовка к школе',
    location: 1,
    schedule: [
      { dayOfWeek: 1, time: '18:00' },
      { dayOfWeek: 5, time: '18:00' },
    ],
  },
  {
    course: 'Английский язык',
    location: 0,
    schedule: [
      { dayOfWeek: 3, time: '15:00' },
      { dayOfWeek: 5, time: '15:00' },
    ],
  },
]

// ─── Headless-создание пользователя (better-auth) ──────────────────────
// `auth.api.createUser` — admin-эндпоинт (нужна admin-сессия). В сиде сессии
// нет, поэтому создаём напрямую через internal-контекст, как это делает
// sign-up-роут better-auth.
async function createDemoUser(role: DemoRole): Promise<number> {
  const def = DEMO_USERS[role]
  const authCtx = await auth.$context
  const hash = await authCtx.password.hash(demoPassword(role))
  const user = await authCtx.internalAdapter.createUser({
    email: def.email,
    name: def.name,
    emailVerified: true,
  })
  await authCtx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: String(user.id),
    password: hash,
  })
  return Number(user.id)
}

/**
 * Полностью пересоздаёт демо-организацию. Идемпотентно: удаляет старую орг
 * (каскад чистит домен + участников + фичи) и demo-пользователей (каскад гасит
 * их активные сессии), затем строит всё заново.
 */
export async function seedDemoOrg(): Promise<{ organizationId: number }> {
  const tz = DEFAULT_TZ
  const todayYmd = todayYmdInTz(tz)
  const today = new Date(`${todayYmd}T00:00:00.000Z`)
  const windowStart = addUTCDays(today, -21)
  const windowEnd = addUTCDays(today, 18)

  // 1. Снос ────────────────────────────────────────────────────────────
  await prisma.organization.deleteMany({ where: { slug: DEMO_SLUG } })
  await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } })

  // 2. Организация ──────────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      slug: DEMO_SLUG,
      timezone: tz,
      metadata: JSON.stringify({ demo: true }),
    },
  })
  const orgId = org.id

  // 3. Пользователи + участники ─────────────────────────────────────────
  const userIds: Record<DemoRole, number> = { owner: 0, manager: 0, teacher: 0 }
  for (const role of DEMO_ROLES) {
    userIds[role] = await createDemoUser(role)
    await prisma.member.create({ data: { organizationId: orgId, userId: userIds[role], role } })
  }
  const teacherId = userIds.teacher

  // 4. Справочники ──────────────────────────────────────────────────────
  const [methodCash, methodCard] = await Promise.all([
    prisma.paymentMethod.create({ data: { organizationId: orgId, name: 'Наличные' } }),
    prisma.paymentMethod.create({ data: { organizationId: orgId, name: 'Карта', commission: 2 } }),
  ])
  await prisma.paymentMethod.create({
    data: { organizationId: orgId, name: 'Перевод (СБП)', commission: 0.5 },
  })

  const rateMain = await prisma.rate.create({
    data: { organizationId: orgId, name: 'Групповая ставка', bid: 500, bonusPerStudent: 50 },
  })
  const rateInd = await prisma.rate.create({
    data: { organizationId: orgId, name: 'Индивидуальная ставка', bid: 900, bonusPerStudent: 0 },
  })

  const groupTypeGroup = await prisma.groupType.create({
    data: { organizationId: orgId, name: 'Групповые занятия', rateId: rateMain.id },
  })
  await prisma.groupType.create({
    data: { organizationId: orgId, name: 'Индивидуальные занятия', rateId: rateInd.id },
  })

  const courseNames = [...new Set(GROUP_DEFS.map((g) => g.course))]
  const courses = new Map<string, number>()
  for (const name of courseNames) {
    const c = await prisma.course.create({ data: { organizationId: orgId, name } })
    courses.set(name, c.id)
  }

  const locations = await Promise.all(
    ['Главный корпус', 'Филиал на Ленина'].map((name) =>
      prisma.location.create({ data: { organizationId: orgId, name } }),
    ),
  )

  await prisma.taxConfig.create({
    data: {
      organizationId: orgId,
      taxSystem: 'USN_INCOME',
      config: { rate: 6 },
    },
  })

  await prisma.paymentProduct.createMany({
    data: [
      { organizationId: orgId, name: 'Абонемент 8 занятий', price: 6400, lessonCount: 8 },
      { organizationId: orgId, name: 'Абонемент 12 занятий', price: 9000, lessonCount: 12 },
    ],
  })

  // 5. Расходы / аренда / зарплаты ──────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      {
        organizationId: orgId,
        name: 'Канцелярия',
        amount: 4200,
        date: ymd(addUTCDays(today, -12)),
      },
      { organizationId: orgId, name: 'Реклама', amount: 15000, date: ymd(addUTCDays(today, -6)) },
      { organizationId: orgId, name: 'Клининг', amount: 8000, date: ymd(addUTCDays(today, -2)) },
    ],
  })
  await prisma.rent.create({
    data: {
      organizationId: orgId,
      locationId: locations[0]!.id,
      startDate: ymd(addUTCDays(today, -60)),
      isMonthly: true,
      amount: 60000,
      comment: 'Аренда главного корпуса',
    },
  })
  await prisma.managerSalary.create({
    data: {
      organizationId: orgId,
      userId: userIds.manager,
      monthlyAmount: 70000,
      startDate: ymd(addUTCDays(today, -60)),
    },
  })
  await prisma.payCheck.createMany({
    data: [
      {
        organizationId: orgId,
        userId: teacherId,
        amount: 45000,
        comment: 'Зарплата',
        type: 'SALARY',
        date: ymd(addUTCDays(today, -30)),
      },
      {
        organizationId: orgId,
        userId: teacherId,
        amount: 5000,
        comment: 'Бонус за посещаемость',
        type: 'BONUS',
        date: ymd(addUTCDays(today, -15)),
      },
      {
        organizationId: orgId,
        userId: teacherId,
        amount: 10000,
        comment: 'Аванс',
        type: 'ADVANCE',
        date: ymd(addUTCDays(today, -3)),
      },
    ],
  })

  // 6. Группы + расписания + уроки + учитель ─────────────────────────────
  interface CreatedGroup {
    id: number
    lessonIds: number[]
    pastLessonIds: number[]
  }
  const createdGroups: CreatedGroup[] = []

  for (const def of GROUP_DEFS) {
    const lessons = generateLessons(def.schedule, windowStart, windowEnd, orgId)
    const group = await prisma.group.create({
      data: {
        organizationId: orgId,
        courseId: courses.get(def.course)!,
        locationId: locations[def.location]!.id,
        groupTypeId: groupTypeGroup.id,
        maxStudents: 10,
        startDate: ymd(windowStart),
        teachers: { create: [{ organizationId: orgId, teacherId, rateId: rateMain.id }] },
        schedules: {
          createMany: {
            data: def.schedule.map((s) => ({
              organizationId: orgId,
              dayOfWeek: s.dayOfWeek,
              time: s.time,
            })),
          },
        },
        lessons: { createMany: { data: lessons } },
      },
      include: { lessons: { select: { id: true, date: true } } },
    })

    // Учитель ведёт уроки — иначе учительский календарь (scoped по lesson.readAll) пуст.
    await prisma.teacherLesson.createMany({
      data: group.lessons.map((l) => ({
        organizationId: orgId,
        lessonId: l.id,
        teacherId,
        bid: rateMain.bid,
        bonusPerStudent: rateMain.bonusPerStudent,
      })),
    })

    createdGroups.push({
      id: group.id,
      lessonIds: group.lessons.map((l) => l.id),
      pastLessonIds: group.lessons.filter((l) => l.date < todayYmd).map((l) => l.id),
    })
  }

  // 7. Ученики + кошельки + оплаты + группы + родители ───────────────────
  // Всё батчами (createMany/createManyAndReturn) — сид должен укладываться в
  // лимит времени роута сброса; ~600 последовательных вставок туда не влезали.

  // Распределение статусов, чтобы все списки учеников были непустыми.
  const STATUSES: Prisma.StudentGroupCreateManyInput['status'][] = [
    ...Array(22).fill('ACTIVE'),
    'TRIAL',
    'TRIAL',
    'DISMISSED',
    'DISMISSED',
    'COMPLETED',
    'COMPLETED',
  ]

  // Заранее фиксируем случайные параметры каждого ученика.
  const seeds = STATUSES.map((status, i) => {
    const firstName = pick(FIRST_NAMES)
    const age = int(6, 16)
    return {
      status,
      groupIdx: i % createdGroups.length,
      balance: status === 'ACTIVE' ? int(-3, 20) : int(0, 6),
      firstName,
      lastName: lastNameFor(firstName),
      age,
      totalLessons: int(8, 60),
      totalPayments: int(1, 8) * 6400,
      dataActual: rng() > 0.4,
      paymentsCount: int(1, 3),
      hasParent: rng() > 0.5,
    }
  })

  const students = await prisma.student.createManyAndReturn({
    data: seeds.map((s) => ({
      organizationId: orgId,
      firstName: s.firstName,
      lastName: s.lastName,
      age: s.age,
      birthDate: ymd(addUTCDays(today, -s.age * 365)),
      lessonsBalance: s.balance,
      totalLessons: s.totalLessons,
      totalPayments: s.totalPayments,
      dataActual: s.dataActual,
    })),
    select: { id: true },
  })

  const wallets = await prisma.wallet.createManyAndReturn({
    data: students.map((st, i) => ({
      organizationId: orgId,
      studentId: st.id,
      name: 'Основной',
      lessonsBalance: seeds[i]!.balance,
      totalLessons: seeds[i]!.totalLessons,
      totalPayments: seeds[i]!.totalPayments,
    })),
    select: { id: true, studentId: true },
  })
  const walletByStudent = new Map(wallets.map((w) => [w.studentId, w.id]))

  // studentsByGroup[i] — id активных/пробных учеников группы i (для посещаемости).
  const studentsByGroup: number[][] = createdGroups.map(() => [])
  students.forEach((st, i) => {
    const s = seeds[i]!
    if (s.status === 'ACTIVE' || s.status === 'TRIAL') studentsByGroup[s.groupIdx]!.push(st.id)
  })

  await prisma.studentGroup.createMany({
    data: students.map((st, i) => ({
      organizationId: orgId,
      studentId: st.id,
      groupId: createdGroups[seeds[i]!.groupIdx]!.id,
      walletId: walletByStudent.get(st.id)!,
      status: seeds[i]!.status,
      statusChangedAt: todayYmd,
    })),
  })

  const payments: Prisma.PaymentCreateManyInput[] = []
  students.forEach((st, i) => {
    const s = seeds[i]!
    const groupId = createdGroups[s.groupIdx]!.id
    const walletId = walletByStudent.get(st.id)!
    for (let p = 0; p < s.paymentsCount; p++) {
      const lessonCount = pick([8, 12] as const)
      const price = lessonCount === 8 ? 6400 : 9000
      payments.push({
        organizationId: orgId,
        studentId: st.id,
        groupId,
        walletId,
        paymentMethodId: pick([methodCash.id, methodCard.id]),
        lessonCount,
        price,
        bidForLesson: Math.round(price / lessonCount),
        productName: `Абонемент ${lessonCount} занятий`,
        date: ymd(addUTCDays(today, -int(1, 40))),
      })
    }
  })
  await prisma.payment.createMany({ data: payments })

  await prisma.studentLessonsBalanceHistory.createMany({
    data: students.map((st, i) => ({
      organizationId: orgId,
      studentId: st.id,
      walletId: walletByStudent.get(st.id)!,
      groupId: createdGroups[seeds[i]!.groupIdx]!.id,
      reason: 'PAYMENT_CREATED',
      delta: 8,
      balanceBefore: seeds[i]!.balance - 8,
      balanceAfter: seeds[i]!.balance,
    })),
  })

  // Родители для части учеников.
  const parentStudentIdx = seeds.map((s, i) => (s.hasParent ? i : -1)).filter((i) => i >= 0)
  if (parentStudentIdx.length > 0) {
    const parents = await prisma.parent.createManyAndReturn({
      data: parentStudentIdx.map(() => {
        const pFirst = pick(PARENT_FIRST)
        return {
          organizationId: orgId,
          firstName: pFirst,
          lastName: lastNameFor(pFirst),
          phone: `+7 (9${int(10, 99)}) ${int(100, 999)}-${int(10, 99)}-${int(10, 99)}`,
        }
      }),
      select: { id: true },
    })
    await prisma.studentParent.createMany({
      data: parents.map((par, k) => ({
        studentId: students[parentStudentIdx[k]!]!.id,
        parentId: par.id,
      })),
    })
  }

  // 8. Посещаемость по прошедшим урокам (одним батчем) ───────────────────
  const attendance: Prisma.AttendanceCreateManyInput[] = []
  for (let g = 0; g < createdGroups.length; g++) {
    for (const lessonId of createdGroups[g]!.pastLessonIds) {
      for (const studentId of studentsByGroup[g]!) {
        const roll = rng()
        const status = roll < 0.7 ? 'PRESENT' : roll < 0.9 ? 'ABSENT' : 'UNSPECIFIED'
        attendance.push({
          organizationId: orgId,
          lessonId,
          studentId,
          status,
          comment: status === 'ABSENT' && rng() > 0.6 ? 'Болел' : '',
        })
      }
    }
  }
  if (attendance.length > 0) await prisma.attendance.createMany({ data: attendance })

  // 9. Магазин ──────────────────────────────────────────────────────────
  const [catStationery, catMerch] = await Promise.all([
    prisma.category.create({ data: { organizationId: orgId, name: 'Канцелярия' } }),
    prisma.category.create({ data: { organizationId: orgId, name: 'Мерч' } }),
  ])
  const PRODUCTS = [
    { name: 'Тетрадь ЕДУДА', price: 150, categoryId: catStationery.id, popular: true },
    { name: 'Ручка гелевая', price: 80, categoryId: catStationery.id },
    { name: 'Набор маркеров', price: 350, categoryId: catStationery.id },
    { name: 'Футболка с логотипом', price: 1200, categoryId: catMerch.id, popular: true },
    { name: 'Значок-эмодзи', price: 120, categoryId: catMerch.id },
    { name: 'Стикерпак', price: 200, categoryId: catMerch.id },
  ]
  const products = await prisma.product.createManyAndReturn({
    data: PRODUCTS.map((pr) => ({
      organizationId: orgId,
      name: pr.name,
      price: pr.price,
      categoryId: pr.categoryId,
      imageUrl: '',
      quantity: int(5, 40),
      popular: pr.popular ?? false,
      rating: 4 + rng(),
      reviews: int(0, 25),
    })),
    select: { id: true },
  })
  const productIds = products.map((p) => p.id)

  // Пара заказов от первых учеников (магазин привязан к ученику).
  const ORDER_STATUSES: Prisma.OrderCreateManyInput['status'][] = [
    'PENDING',
    'COMPLETED',
    'COMPLETED',
    'CANCELLED',
  ]
  await prisma.order.createMany({
    data: students.slice(0, 4).map((st, o) => ({
      organizationId: orgId,
      productId: pick(productIds),
      studentId: st.id,
      quantity: int(1, 3),
      status: ORDER_STATUSES[o % ORDER_STATUSES.length]!,
    })),
  })

  return { organizationId: orgId }
}
