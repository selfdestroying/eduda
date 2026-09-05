import { prisma } from '@repo/db'
import { bindByPhone, readBindings, readCommand, resubscribeAll, unsubscribeAll } from '../bind'
import { cabinetUrl, env } from '../env'
import { phoneFromVCard } from '../phone'
import { askForContact, sendMessage } from '../providers/max'
import type { Reply, RouteRequest } from '../route'
import { buildBindSummary } from '../summary'

/**
 * Вебхук MAX. Как и у VK: в обработчике только запись в базу, ответ родителю
 * уходит после того, как мы ответили 200 — держать вебхук на походе наружу
 * значит собирать повторы.
 *
 * Мультибота здесь нет, но эндпоинт всё равно свой: в апдейте MAX нет никакого
 * признака бота, и различать их можно только по URL.
 *
 * Разговор с ботом устроен как одна дорога и три команды:
 *
 * 1. «Начать» — приветствие с кнопкой «отправить номер».
 * 2. Номер пришёл — рассказ о детях, которых по нему нашли.
 * 3. Всё остальное — молчание. Ни `/start`, ни «привет», ни случайный текст
 *    ответа не получают: повторное приветствие в ответ на реплику выглядит как
 *    сбой, а «я вас не понял» учит родителя, что писать сюда бесполезно.
 *
 * Команды из меню (`/stop`, `/resume`, `/cabinet`) — исключение: их родитель
 * нажимает намеренно, и молчание на них было бы поломкой.
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

const ASK = [
  'Здравствуйте! 👋',
  '',
  'Я бот школы: напоминаю о занятиях, чтобы их не приходилось держать в голове.',
  '',
  'Нажмите кнопку ниже — по номеру телефона найду ваших детей. Номер нужен только для этого, платформа подтверждает его сама.',
].join('\n')

const NOT_FOUND = [
  'По этому номеру я никого не нашёл. 🤔',
  '',
  'Попросите администратора школы проверить, что в карточке ребёнка записан именно этот номер, и нажмите кнопку ещё раз.',
].join('\n')

const STOPPED = 'Напоминания отключены. 🔕\n\nВключить обратно — команда /resume.'
const ALREADY_STOPPED = 'Напоминания и так отключены. Включить — команда /resume.'
const RESUMED = 'Напоминания снова включены. 🔔'
const ALREADY_ACTIVE = 'Напоминания и так приходят. Отключить — команда /stop.'

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
    if (parents.length === 0) {
      reply(userId, NOT_FOUND, true)
      return
    }

    reply(
      userId,
      await buildBindSummary(
        prisma,
        parents.map((parent) => parent.parentId),
      ),
    )
    return
  }

  await onCommand(userId, body?.text ?? '')
}

/**
 * Три команды меню. Аккаунт без единой привязки на любую из них получает
 * приветствие с кнопкой: отключать, включать и открывать ему нечего, а начать
 * — есть с чего.
 */
async function onCommand(userId: string, text: string) {
  const command = readCommand(text)
  if (!command) return

  const bindings = await readBindings(prisma, 'MAX', userId)
  if (bindings.length === 0) {
    reply(userId, ASK, true)
    return
  }

  if (command === 'cabinet') {
    reply(userId, cabinetText(bindings))
    return
  }

  if (command === 'stop') {
    const count = await unsubscribeAll(prisma, 'MAX', userId)
    reply(userId, count > 0 ? STOPPED : ALREADY_STOPPED)
    return
  }

  const count = await resubscribeAll(prisma, 'MAX', userId)
  reply(userId, count > 0 ? RESUMED : ALREADY_ACTIVE)
}

/**
 * Ссылка на кабинет — своя у каждой школы: `accessToken` принадлежит родителю
 * в одной школе, и одной ссылкой два кабинета не открыть.
 */
function cabinetText(bindings: Awaited<ReturnType<typeof readBindings>>): string {
  const head = '🔗 Личный кабинет — расписание, посещаемость и оплаты:'

  return bindings.length === 1
    ? `${head}\n\n${cabinetUrl(bindings[0]!.accessToken)}`
    : [
        head,
        '',
        ...bindings.map((binding) => `${binding.organization}\n${cabinetUrl(binding.accessToken)}`),
      ].join('\n')
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
