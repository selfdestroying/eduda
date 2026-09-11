import { prisma } from '@repo/db'
import { listBots, type Bot } from '../bots'
import { drainOutbox, type SenderFor } from '../drain'
import { env } from '../env'
import { planLessonReminders, type PlanResult } from '../plan'
import { ensureCommands, ensureSubscription, sendReminder } from '../providers/max'
import type { Reply, RouteRequest } from '../route'

/**
 * Роут планировщика. Дёргает его системный cron той же машины, раз в десять
 * минут — снаружи, а не таймером в памяти процесса: таймер умирает с каждым
 * деплоем, молча и до тех пор, пока кто-нибудь не заметит.
 *
 *   flock -n /tmp/notify.lock curl -fsS -m 300 -H "X-Notify-Key: …" \
 *     http://localhost:3006/dispatch
 *
 * `flock` держит только `curl`, а не сам проход, — от двух проходов по одной
 * очереди защищает бронь строки в `drain.ts`.
 *
 * Крон один на всех ботов: расписание рассылки живёт в настройках школы, а крон
 * только тикает. Изоляция — внутри прохода: сбой бота или школы пишется в лог и
 * не останавливает остальных.
 *
 * `?dry=1` — прогон вхолостую: показывает, что запланировалось бы, и не пишет
 * ничего. Отправку в холостом режиме не трогаем вовсе — сообщение родителю
 * назад не отзовёшь.
 */

class Rollback extends Error {
  constructor(readonly result: PlanResult) {
    super('dry run')
  }
}

/**
 * Боты, которым меню команд уже поставлено в этом процессе. Ключ — токен:
 * школа может переподключить бота с другим токеном, и новому тоже нужно меню.
 */
const withCommands = new Set<string>()

export async function handleDispatch(req: RouteRequest): Promise<Reply> {
  // Nginx проксирует бота целиком, так что ключ обязателен: `/dispatch` не
  // должен быть доступен снаружи даже при упрощённом конфиге.
  if (req.header('x-notify-key') !== env.notifyKey) {
    return { status: 401, text: 'unauthorized' }
  }

  if (req.url.searchParams.get('dry') === '1') {
    return { text: await dryRun() }
  }

  const bots = await listBots(prisma)

  // Подписка — первым делом и на каждом запуске: у MAX она умирает через восемь
  // часов без успешных ответов, молча. Обе функции ошибок не бросают, поэтому
  // сбой у бота одной школы не мешает остальным.
  //
  // Боты — параллельно: у каждого до четырёх запросов с таймаутом в десять
  // секунд, и на медленном MAX очередь из десятка ботов отодвигала бы план на
  // минуты — окно «за 30 минут» успевало бы уехать.
  const subscriptions = await Promise.all(
    bots.map(async (bot) => {
      const status = await ensureSubscription(bot.token, bot.webhookUrl, bot.secret)
      if (!withCommands.has(bot.token) && (await ensureCommands(bot.token))) {
        withCommands.add(bot.token)
      }
      return { key: bot.key, status }
    }),
  )
  const subscriptionsOk = subscriptions.every((item) => item.status === 'есть')

  const plan = await planLessonReminders(prisma)
  const drain = await drainOutbox(prisma, senderForBots(bots))

  const summary =
    `школ ${plan.organizations}, запланировано ${plan.planned}, отправлено ${drain.sent}, ` +
    `повтор ${drain.retried}, отказов ${drain.failed}; ` +
    `подписки: ${subscriptions.map((item) => `${item.key} ${item.status}`).join(', ') || 'ботов нет'}`

  // В лог — только непустой проход: крон приходит 144 раза в сутки, и
  // одинаковые пустые строки утопили бы те, ради которых лог вообще читают.
  const idle = subscriptionsOk && plan.planned + drain.sent + drain.retried + drain.failed === 0
  if (!idle) console.log(`dispatch: ${summary}`)

  return { text: summary }
}

/**
 * Отправитель по привязке: `ownBot = false` — бот ЕДУДА, иначе бот её школы.
 * `null` — токена нет; повторять ли, решает дренаж.
 */
function senderForBots(bots: Bot[]): SenderFor {
  const byOrganization = new Map(bots.map((bot) => [bot.organizationId, bot]))

  return (messenger) => {
    const bot = byOrganization.get(messenger.ownBot ? messenger.organizationId : null)
    return bot ? (externalId, text) => sendReminder(bot.token, externalId, text) : null
  }
}

/**
 * Планирование в транзакции, которая откатывается: тот же код, что и на боевом
 * проходе, поэтому показанное число — настоящее, а не пересчитанное отдельной
 * веткой, которая разъедется с основной.
 *
 * Транзакция — своя у каждой школы. В общей первый же упавший запрос оборвал бы
 * её, и все следующие школы «не спланировались» бы следом: прогон показал бы
 * меньше, чем запланирует боевой проход, где сбой одной школы остальным не мешает.
 */
async function dryRun(): Promise<string> {
  const plan: PlanResult = { organizations: 0, planned: 0 }
  const now = new Date()

  const schools = await prisma.organization.findMany({
    where: { remindersEnabled: true },
    select: { id: true },
  })

  for (const school of schools) {
    try {
      await prisma.$transaction(async (tx) => {
        throw new Rollback(await planLessonReminders(tx, now, school.id))
      })
    } catch (error) {
      if (!(error instanceof Rollback)) throw error
      plan.organizations += error.result.organizations
      plan.planned += error.result.planned
    }
  }

  const pending = await prisma.notificationOutbox.count({ where: { status: 'PENDING' } })
  const bots = await listBots(prisma)

  return [
    'вхолостую, ничего не записано и не отправлено',
    `боты: ${bots.map((bot) => bot.key).join(', ') || 'нет'}`,
    `школ в плане: ${plan.organizations}`,
    `запланировалось бы: ${plan.planned}`,
    `уже ждёт отправки: ${pending}`,
  ].join('\n')
}
