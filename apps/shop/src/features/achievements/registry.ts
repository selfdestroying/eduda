import {
  Award,
  Cake,
  Coins,
  Flame,
  GraduationCap,
  HandHeart,
  Layers,
  ShoppingBag,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Stats } from './stats'

/** Визуальные секции страницы. Порядок здесь = порядок на экране. */
export const GROUPS = [
  { id: 'study', title: 'Учёба' },
  { id: 'shop', title: 'Магазин и коины' },
  { id: 'special', title: 'Особые' },
] as const

export type GroupId = (typeof GROUPS)[number]['id']

/** Уровень достижения: свой порог, своё название и своя награда. */
export type Tier = { title: string; target: number; coins: number }

/**
 * Каталог достижений. Живёт в коде, а не в БД — как реестр фича-флагов платформы
 * и `ATTENDANCE_COINS`: добавить достижение или уровень значит дописать строчку,
 * без миграции и без админки. Настроек на школу нет.
 *
 * В БД (`StudentAchievement`) попадает только факт получения со снимком награды,
 * поэтому переставить порог или сумму можно в любой момент: уже выданное не
 * меняется.
 */
export type Achievement = {
  key: string
  group: GroupId
  icon: LucideIcon
  /** Подпись под названием уровня. Порог подставляется — плюрализация не нужна. */
  hint: (target: number) => string
  /** Метрика, по которой считается прогресс. */
  value: (stats: Stats) => number
  /** Уровни ПО ВОЗРАСТАНИЮ порога. Один элемент — обычное достижение без уровней. */
  tiers: Tier[]
  /**
   * Ключ хранения, если он не выводится из уровня. Нужен повторяемым достижениям:
   * в ключ подмешивается период (`birthday:2026`), и уникальный индекс сам
   * разрешает получить награду ещё раз в следующем году. `null` — «сейчас
   * недоступно вообще»: у ученика без даты рождения подарка не существует.
   */
  storageKey?: (stats: Stats) => string | null
}

/**
 * Единица измерения награды — ОДНО ЗАНЯТИЕ (`ATTENDANCE_COINS` = 10 коинов).
 * Правя суммы, считайте в занятиях, а не в коинах, иначе экономика уезжает
 * незаметно. Инварианты (их проверяет `scripts/check-achievements.ts`):
 *
 * 1. Ни один уровень не платит больше 30 занятий разом (300 коинов).
 * 2. Всё, что доступно за первые 10 занятий, — не больше 20 занятий наград.
 *    Раньше там набегало 700 коинов на 100 заработанных посещаемостью: ученик
 *    за два месяца выкупал почти всю витрину и терял смысл ходить дальше.
 * 3. Суммарно все уровни — не больше 170 занятий (сейчас 1605 коинов), т.е.
 *    награды остаются добавкой к посещаемости, а не основным доходом.
 *
 * Достижения «заработать N коинов» здесь нет намеренно: `ACHIEVEMENT_CLAIM`
 * пишется в тот же леджер, поэтому метрика считала бы собственные выплаты и
 * награда финансировала бы следующую награду. Плюс это был дубль `attend` —
 * заработок с посещений и есть число посещений, умноженное на 10.
 */
export const ACHIEVEMENTS: Achievement[] = [
  // ─── Учёба ───────────────────────────────────────────────────────────────
  {
    key: 'attend',
    group: 'study',
    icon: GraduationCap,
    hint: (n) => `Посещений: ${n}`,
    value: (s) => s.presentTotal,
    // Награда растёт быстрее порога: за 100 занятий набегает 555 коинов — 55%
    // сверху к самой посещаемости. Лояльность окупается, но основной доход
    // остаётся у занятий.
    tiers: [
      { title: 'Постоянный', target: 10, coins: 30 },
      { title: 'Прилежный', target: 25, coins: 75 },
      { title: 'Ветеран', target: 50, coins: 150 },
      { title: 'Легенда', target: 100, coins: 300 },
    ],
  },
  {
    key: 'streak',
    group: 'study',
    icon: Flame,
    hint: (n) => `Занятий подряд: ${n}`,
    value: (s) => s.presentStreak,
    // Выше десяти не поднимаем: одна болезнь обнуляет серию, и длинный уровень
    // превращается из награды в наказание.
    //
    // Суммы намеренно мелкие: серия закрывается теми же первыми десятью
    // занятиями, что и `attend:10`, то есть платит за одно и то же дважды.
    tiers: [
      { title: 'В ритме', target: 3, coins: 15 },
      { title: 'Без пропусков', target: 5, coins: 30 },
      { title: 'Железная воля', target: 10, coins: 75 },
    ],
  },
  {
    key: 'graduate',
    group: 'study',
    icon: Award,
    hint: () => 'Завершить курс до конца',
    value: (s) => s.completedGroups,
    // Разово за всю жизнь, не за каждый курс: 15 занятий сверху.
    tiers: [{ title: 'Выпускник', target: 1, coins: 150 }],
  },
  {
    key: 'multi_group',
    group: 'study',
    icon: Layers,
    hint: (n) => `Заниматься в ${n} группах одновременно`,
    value: (s) => s.activeGroups,
    // Вторая группа уже удваивает доход с посещений — платить сверху много
    // не за что.
    tiers: [{ title: 'Многостаночник', target: 2, coins: 75 }],
  },

  // ─── Магазин и коины ─────────────────────────────────────────────────────
  {
    key: 'orders',
    group: 'shop',
    icon: ShoppingBag,
    hint: (n) => `Заказов: ${n}`,
    value: (s) => s.ordersCount,
    tiers: [
      { title: 'Первая покупка', target: 1, coins: 20 },
      { title: 'Постоянный покупатель', target: 5, coins: 50 },
      { title: 'Завсегдатай', target: 15, coins: 120 },
    ],
  },
  {
    key: 'spent',
    group: 'shop',
    icon: Coins,
    hint: (n) => `Потрачено коинов: ${n}`,
    value: (s) => s.coinsSpent,
    // Это кешбэк, и он обязан быть меньше 100%, иначе покупка удешевляет
    // следующую покупку. 235 коинов на 2000 потраченных — около 12%.
    // Пороги привязаны к реальному доходу: за 100 занятий ученик получает
    // порядка 2500 коинов всего, поэтому «потратить 5000» было недостижимо.
    tiers: [
      { title: 'Транжира', target: 300, coins: 25 },
      { title: 'Мот', target: 1000, coins: 60 },
      { title: 'Магнат', target: 2000, coins: 150 },
    ],
  },

  // ─── Особые ──────────────────────────────────────────────────────────────
  {
    key: 'welcome',
    group: 'special',
    icon: HandHeart,
    hint: () => 'Просто загляните в кабинет',
    // Единственная награда, доступная с первого захода: без неё ученик, у
    // которого всё «3 из 10», может не понять, что кнопка вообще существует.
    value: () => 1,
    tiers: [{ title: 'Добро пожаловать', target: 1, coins: 30 }],
  },
  {
    key: 'birthday',
    group: 'special',
    icon: Cake,
    hint: () => 'Подарок от школы — забрать можно в любой день после дня рождения',
    value: (s) => (s.birthdayKey ? 1 : 0),
    // Единственный повторяемый доход мимо учёбы — держим на уровне месяца
    // занятий, иначе он копится сам по себе.
    tiers: [{ title: 'С днём рождения!', target: 1, coins: 100 }],
    storageKey: (s) => s.birthdayKey,
  },
  {
    key: 'collector',
    group: 'special',
    icon: Award,
    hint: (n) => `Получить ${n} других наград`,
    value: (s) => s.claimed.size,
    // Пять набиралось теми же первыми десятью занятиями, что и всё остальное,
    // и добавляло к стартовому рывку ещё одну крупную выплату. Восемь требуют
    // выйти за пределы «учёба» — покупок или второго курса.
    tiers: [{ title: 'Коллекционер наград', target: 8, coins: 150 }],
  },
]

/**
 * Сколько уровней уже забрано. Уровни идут по возрастанию, поэтому «сколько
 * забрано» — это и есть индекс следующего.
 */
export function claimedLevel(achievement: Achievement, stats: Stats): number {
  let level = 0
  while (level < achievement.tiers.length) {
    const key = tierKey(achievement, stats, level)
    if (!key || !stats.claimed.has(key)) break
    level++
  }
  return level
}

/**
 * Ключ уровня в БД. У достижения с уровнями порог входит в ключ, поэтому новый
 * уровень не конфликтует с уже полученным.
 */
export function tierKey(achievement: Achievement, stats: Stats, level: number): string | null {
  if (achievement.storageKey) return achievement.storageKey(stats)

  const tier = achievement.tiers[level]
  if (!tier) return null
  return achievement.tiers.length === 1 ? achievement.key : `${achievement.key}:${tier.target}`
}

/**
 * Забирал ли ученик хоть что-то по этому достижению — в любом виде: уровнем,
 * подарком прошлого года. Нужно, чтобы не прятать полученное, когда достижение
 * стало недоступным (школа стёрла дату рождения).
 */
export function hasAnyClaim(achievement: Achievement, stats: Stats): boolean {
  const prefix = `${achievement.key}:`
  for (const key of stats.claimed.keys()) {
    if (key === achievement.key || key.startsWith(prefix)) return true
  }
  return false
}
