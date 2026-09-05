import { prisma } from '@repo/db'
import { drainOutbox, type Sender } from '../drain'
import { env } from '../env'
import { planLessonReminders, type PlanResult } from '../plan'
import { ensureSubscription, sendReminder as sendMax } from '../providers/max'
import { sendMessage as sendVk } from '../providers/vk'
import type { Reply, RouteRequest } from '../route'

/**
 * Роут планировщика. Дёргает его системный cron той же машины, раз в десять
 * минут — снаружи, а не таймером в памяти процесса: таймер умирает с каждым
 * деплоем, молча и до тех пор, пока кто-нибудь не заметит.
 *
 *   flock -n /tmp/notify.lock curl -fsS -m 300 -H "X-Notify-Key: …" \
 *     http://localhost:3006/dispatch
 *
 * `flock` заменяет флаг «уже выполняется», поэтому его здесь нет.
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

export async function handleDispatch(req: RouteRequest): Promise<Reply> {
  // Nginx проксирует бота целиком, так что ключ обязателен: `/dispatch` не
  // должен быть доступен снаружи даже при упрощённом конфиге.
  if (req.header('x-notify-key') !== env.notifyKey) {
    return { status: 401, text: 'unauthorized' }
  }

  if (req.url.searchParams.get('dry') === '1') {
    return { text: await dryRun() }
  }

  // Первым делом и на каждом запуске: подписка MAX умирает через восемь часов
  // без успешных ответов, молча. «Настроил один раз» здесь не работает.
  const subscription = await ensureSubscription()

  const senders: Partial<Record<'VK' | 'MAX', Sender>> = { VK: sendVk }
  if (env.max) senders.MAX = sendMax

  const plan = await planLessonReminders(prisma)
  const drain = await drainOutbox(prisma, senders)

  return {
    text: [
      `подписка MAX: ${subscription}`,
      `школ в плане: ${plan.organizations}`,
      `запланировано: ${plan.planned}`,
      `отправлено: ${drain.sent}`,
      `повторим позже: ${drain.retried}`,
      `отказов: ${drain.failed}`,
    ].join('\n'),
  }
}

/**
 * Планирование в транзакции, которая откатывается: тот же код, что и на боевом
 * проходе, поэтому показанное число — настоящее, а не пересчитанное отдельной
 * веткой, которая разъедется с основной.
 */
async function dryRun(): Promise<string> {
  let plan: PlanResult = { organizations: 0, planned: 0 }

  try {
    await prisma.$transaction(async (tx) => {
      throw new Rollback(await planLessonReminders(tx))
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
    plan = error.result
  }

  const pending = await prisma.notificationOutbox.count({ where: { status: 'PENDING' } })

  return [
    'вхолостую, ничего не записано и не отправлено',
    `школ в плане: ${plan.organizations}`,
    `запланировалось бы: ${plan.planned}`,
    `уже ждёт отправки: ${pending}`,
  ].join('\n')
}
