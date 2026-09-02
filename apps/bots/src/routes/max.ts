import { prisma } from '@repo/db'
import { bindByPhone, isStopCommand, unsubscribeAll } from '../bind'
import { env } from '../env'
import { phoneFromVCard } from '../phone'
import { askForContact, sendMessage } from '../providers/max'
import type { Reply, RouteRequest } from '../route'

/**
 * Вебхук MAX. Как и у VK: в обработчике только запись в базу, ответ родителю
 * уходит после того, как мы ответили 200 — держать вебхук на походе наружу
 * значит собирать повторы.
 *
 * Мультибота здесь нет, но эндпоинт всё равно свой: в апдейте MAX нет никакого
 * признака бота, и различать их можно только по URL.
 */

type MaxUpdate = {
  update_type?: string
  /** `bot_started` / `bot_stopped` */
  user?: { user_id?: number }
  /** `message_created` */
  message?: {
    sender?: { user_id?: number }
    body?: {
      text?: string
      attachments?: { type?: string; payload?: { vcf_info?: string } }[]
    }
  }
}

const OK: Reply = { text: 'ok' }

const ASK = 'Здравствуйте! Нажмите кнопку ниже — по номеру телефона я найду вашего ребёнка в школе.'

const NOT_FOUND =
  'Такого номера в школах нет. Проверьте у администратора, что записан именно этот номер.'

const STOPPED = 'Напоминания отключены. Чтобы включить обратно, отправьте номер ещё раз.'

export async function handleMax(req: RouteRequest): Promise<Reply> {
  const max = env.max
  // Бот не заведён — публикация в MAX требует верифицированного юрлица.
  if (!max) return { status: 503, text: 'max is not configured' }

  if (req.header('x-max-bot-api-secret') !== max.secret) {
    console.warn('max: событие с чужим секретом или без него — отброшено')
    return { status: 403, text: 'forbidden' }
  }

  let update: MaxUpdate
  try {
    update = JSON.parse(req.body) as MaxUpdate
  } catch {
    return { status: 400, text: 'bad request' }
  }

  switch (update.update_type) {
    case 'bot_started': {
      const userId = userOf(update.user?.user_id)
      if (userId) reply(userId, ASK, true)
      return OK
    }

    // Родитель заблокировал бота — тот же смысл, что `message_deny` у VK.
    case 'bot_stopped': {
      const userId = userOf(update.user?.user_id)
      if (userId) await unsubscribeAll(prisma, 'MAX', userId)
      return OK
    }

    case 'message_created':
      await onMessage(update)
      return OK

    default:
      return OK
  }
}

function userOf(id: number | undefined): string | null {
  return typeof id === 'number' && id > 0 ? String(id) : null
}

async function onMessage(update: MaxUpdate) {
  const userId = userOf(update.message?.sender?.user_id)
  if (!userId) return

  const body = update.message?.body
  const phone = readPhone(body?.attachments)

  if (phone) {
    const parents = await bindByPhone(prisma, userId, phone)
    reply(
      userId,
      parents.length > 0
        ? `Готово. Напоминания о занятиях будут приходить сюда — подключено детей: ${parents.length}.\n\nОтключить — команда /stop.`
        : NOT_FOUND,
    )
    return
  }

  if (isStopCommand(body?.text ?? '')) {
    const count = await unsubscribeAll(prisma, 'MAX', userId)
    reply(userId, count > 0 ? STOPPED : ASK, count === 0)
    return
  }

  reply(userId, ASK, true)
}

/**
 * Телефон приезжает вложением `contact`: в `payload.vcf_info` лежит vCard, и
 * номер там — единственный способ его узнать. Номер, пришедший этой кнопкой,
 * платформа уже подтвердила, поэтому кода сверх него не спрашиваем.
 */
function readPhone(
  attachments: { type?: string; payload?: { vcf_info?: string } }[] | undefined,
): string | null {
  const contact = attachments?.find((item) => item.type === 'contact')
  const vcf = contact?.payload?.vcf_info
  return vcf ? phoneFromVCard(vcf) : null
}

/**
 * Ответ — после 200, поэтому упавшая отправка только пишется в лог.
 *
 * Смотрим именно на результат: провайдер ошибки не бросает, а возвращает их
 * (так их читает дренаж очереди), и один `.catch()` ловил бы только падения
 * рантайма — отказ MAX уходил бы в тишину.
 */
function reply(userId: string, text: string, withButton = false) {
  const send = withButton ? askForContact(userId, text) : sendMessage(userId, text)
  void send
    .then((result) => {
      if (!result.ok) console.error('max: ответ родителю не ушёл —', result.error)
    })
    .catch((error) => {
      console.error('max: ответ родителю не ушёл', error)
    })
}
