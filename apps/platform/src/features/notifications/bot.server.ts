import { encryptBotToken } from '@repo/core/max-bots'
import { Prisma } from '@repo/db'
import { ConflictError, NotFoundError } from '@/src/lib/error'

/**
 * Собственный бот MAX школы: прочитать, проверить токен, сохранить, включить и
 * выключить.
 *
 * Клиент первым параметром и без `server-only` — как остальные ядра фичи: так
 * это зовёт и экшен, и `scripts/check-reminders.ts`. Токен наружу не отдаётся
 * никогда: после сохранения его не видит ни владелец, ни управляющий.
 */

export type MaxBotInfo = {
  username: string
  name: string | null
  avatarUrl: string | null
  /** Рассылает ли школа этим ботом. Выключенный хранится вместе с токеном. */
  enabled: boolean
} | null

export async function readMaxBot(
  db: Prisma.TransactionClient,
  organizationId: number,
): Promise<MaxBotInfo> {
  return db.organizationMaxBot.findUnique({
    where: { organizationId },
    select: { username: true, name: true, avatarUrl: true, enabled: true },
  })
}

/** Бот глазами MAX — то, что покажет карточка. */
export type MaxBotProfile = { username: string; name: string | null; avatarUrl: string | null }

/** Что MAX говорит о боте по токену. Параметром — чтобы проверка не ходила в сеть. */
export type MaxMe = (
  token: string,
) => Promise<
  | { ok: true; username: string | null; name: string | null; avatarUrl: string | null }
  | { ok: false; status: number | null }
>

export const fetchMaxMe: MaxMe = async (token) => {
  try {
    const response = await fetch('https://platform-api2.max.ru/me', {
      // Именно так: без `Bearer` MAX отвечает 401 при живом токене.
      headers: { Authorization: token },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return { ok: false, status: response.status }

    const me = (await response.json()) as {
      username?: string | null
      first_name?: string | null
      avatar_url?: string | null
    }
    return {
      ok: true,
      username: me.username ?? null,
      name: me.first_name ?? null,
      avatarUrl: me.avatar_url ?? null,
    }
  } catch (error) {
    // `fetch failed` без статуса у MAX — почти всегда TLS: корню Минцифры
    // процесс не доверяет, нужен `NODE_EXTRA_CA_CERTS` в записи pm2 платформы.
    console.error('notifications: MAX /me недоступен —', String(error))
    return { ok: false, status: null }
  }
}

/**
 * Кнопка «Тест»: токен принят MAX, и бот годится школе — у него есть публичное
 * имя, это не бот ЕДУДА и не бот другой школы. Отдаёт профиль, чтобы школа
 * увидела, чей это бот, до того как рассылка на него переедет. Ничего не пишет.
 */
export async function testMaxBotToken(
  db: Prisma.TransactionClient,
  organizationId: number,
  token: string,
  me: MaxMe = fetchMaxMe,
): Promise<MaxBotProfile> {
  const answer = await me(token)
  if (!answer.ok) {
    throw new ConflictError(
      answer.status === 401
        ? 'MAX не принял токен. Скопируйте его заново в разделе бота на платформе MAX для партнёров.'
        : 'Не удалось связаться с MAX. Попробуйте ещё раз через пару минут.',
    )
  }
  if (!answer.username) {
    throw new ConflictError(
      'У бота нет публичного имени, а без него родителям не дать ссылку. Задайте имя в настройках бота.',
    )
  }

  // Один бот на две школы — это каждое событие дважды: у каждой своя подписка
  // на вебхук, и на «Начать» родитель получил бы два приветствия. Бот ЕДУДА в
  // роли «своего» — то же самое. Его узнаём прежде всего по токену: имя в
  // `NEXT_PUBLIC_MAX_BOT` необязательно и пишется как угодно, а токен платформе
  // нужен всё равно — им проверяется подпись мини-приложения.
  if (token === process.env.MAX_BOT_TOKEN || answer.username === process.env.NEXT_PUBLIC_MAX_BOT) {
    throw new ConflictError('Это бот ЕДУДА. Подключите отдельного бота своей школы.')
  }
  // Подсказка до записи. От двух школ, сохраняющих одного бота одновременно,
  // защищает уникальный индекс по `username` — см. `connectMaxBot`.
  const taken = await db.organizationMaxBot.findFirst({
    where: { username: answer.username, organizationId: { not: organizationId } },
    select: { organizationId: true },
  })
  if (taken) {
    throw new ConflictError('Этот бот уже подключён к другой школе.')
  }

  return { username: answer.username, name: answer.name, avatarUrl: answer.avatarUrl }
}

/**
 * Сохраняет бота и сразу включает: с ближайшего прохода крона рассылка идёт
 * через него. Токен проверяется заново, а не берётся на веру от «Теста»: между
 * кнопками поле могли поменять, а экшен зовут и мимо формы.
 *
 * Сохранённого бота заменить другим нельзя: подписка прежнего осталась бы на том
 * же адресе `/max/<organizationId>` с тем же секретом, и его события разбирались
 * бы от имени нового. Тот же бот с новым токеном — можно: подписка у бота одна.
 */
export async function connectMaxBot(
  db: Prisma.TransactionClient,
  organizationId: number,
  token: string,
  me: MaxMe = fetchMaxMe,
): Promise<NonNullable<MaxBotInfo>> {
  const profile = await testMaxBotToken(db, organizationId, token, me)

  const saved = await readMaxBot(db, organizationId)
  if (saved && saved.username !== profile.username) {
    throw new ConflictError(
      `У школы уже сохранён бот @${saved.username}. Заменить его другим пока нельзя.`,
    )
  }

  const tokenEnc = encryptBotToken(token)

  try {
    const bot = await db.organizationMaxBot.upsert({
      where: { organizationId },
      create: { organizationId, tokenEnc, ...profile, enabled: true },
      update: { tokenEnc, ...profile, enabled: true },
      select: { username: true, name: true, avatarUrl: true, enabled: true },
    })

    console.log(`notifications: школа ${organizationId} подключила бота @${bot.username}`)
    return bot
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Этот бот уже подключён к другой школе.')
    }
    throw error
  }
}

/**
 * Выбор между ботом ЕДУДА и своим: включает или выключает сохранённого бота.
 * Выключенный остаётся с токеном — вернуться к нему можно без повторного ввода.
 * Привязки родителей к обоим ботам не трогаются: рассылка просто идёт через
 * привязки к тому, что включён.
 */
export async function setMaxBotEnabled(
  db: Prisma.TransactionClient,
  organizationId: number,
  enabled: boolean,
): Promise<NonNullable<MaxBotInfo>> {
  const { count } = await db.organizationMaxBot.updateMany({
    where: { organizationId },
    data: { enabled },
  })
  if (count === 0) throw new NotFoundError('У школы нет сохранённого бота.')

  console.log(
    `notifications: школа ${organizationId} ${enabled ? 'включила своего бота' : 'вернулась на бота ЕДУДА'}`,
  )
  return (await readMaxBot(db, organizationId))!
}
