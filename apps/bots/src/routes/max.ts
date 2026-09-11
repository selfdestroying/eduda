import { prisma } from '@repo/db'
import { bindByPhone, readBindings, readCommand, resubscribeAll, unsubscribeAll } from '../bind'
import { botByPath, scopeOf, type Bot } from '../bots'
import { cabinetUrl } from '../env'
import { phoneFromVCard } from '../phone'
import {
  answerCallback,
  askForContact,
  RESUME,
  RESUME_BUTTON,
  sendMessage,
  STOP,
  STOP_BUTTON,
} from '../providers/max'
import type { Reply, RouteRequest } from '../route'
import { buildBindSummary } from '../summary'

/**
 * Вебхук MAX. В обработчике только запись в базу, ответ родителю уходит после
 * того, как мы ответили 200 — держать вебхук на походе наружу значит собирать
 * повторы.
 *
 * Ботов несколько: бот ЕДУДА на `/max` и боты школ на `/max/<organizationId>`.
 * В апдейте MAX нет никакого признака бота, поэтому различать их можно только
 * по адресу. Всё, что бот делает с привязками, ограничено его областью
 * (`scopeOf`): бот школы не видит родителей других школ.
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
 * нажимает намеренно, и молчание на них было бы поломкой. Туда же кнопка
 * отписки под напоминанием: она приезжает событием `message_callback`.
 *
 * Лог — по строке на привязку и на отписку: на «бот меня не находит» и «почему
 * мне перестало приходить» иначе нечем ответить. Номер в лог попадает только
 * последними цифрами.
 */

type MaxUpdate = {
  update_type?: string
  /** `bot_started` / `bot_stopped` */
  user?: { user_id?: number }
  /** `message_callback` — что нажали и чем на это ответить. */
  callback?: {
    callback_id?: string
    payload?: string
    user?: { user_id?: number }
  }
  /** `message_created`, а у `message_callback` — сообщение с кнопкой. */
  message?: {
    sender?: { user_id?: number }
    recipient?: { user_id?: number }
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
  const bot = await botByPath(prisma, req.url.pathname)
  // Бот ЕДУДА не заведён, у школы нет своего бота или его токен не читается.
  if (!bot) return { status: 404, text: 'unknown bot' }

  if (req.header('x-max-bot-api-secret') !== bot.secret) {
    console.warn(`max[${bot.key}]: событие с чужим секретом или без него — отброшено`)
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
      if (userId) reply(bot, userId, ASK, true)
      return OK
    }

    // Родитель заблокировал бота — это отписка.
    case 'bot_stopped': {
      const userId = userOf(update.user?.user_id)
      if (userId) {
        const count = await unsubscribeAll(prisma, scopeOf(bot), userId)
        console.log(`max[${bot.key}]: user ${userId} заблокировал бота — отписано ${count}`)
      }
      return OK
    }

    case 'message_created':
      await onMessage(bot, update)
      return OK

    // Кнопка под напоминанием.
    case 'message_callback':
      await onCallback(bot, update)
      return OK

    default:
      return OK
  }
}

function userOf(id: number | undefined): string | null {
  return typeof id === 'number' && id > 0 ? String(id) : null
}

// ─── Кнопка под напоминанием ────────────────────────────────────────

const OFF_NOTE = '🔕 Напоминания отключены. Вернуть — кнопкой ниже.'
const ON_NOTE = '🔔 Напоминания снова приходят.'

/**
 * Приписка о состоянии снимается перед тем, как поставить новую: иначе
 * нажатия туда-обратно копят хвост из строк на одном и том же сообщении.
 *
 * Отрезается ровно свой хвост, а не всё после первого эмодзи: текст выше —
 * шаблон школы, и она вправе написать там что угодно.
 */
const NOTE =
  /\n\n(?:🔕 Напоминания отключены\. Вернуть — кнопкой ниже\.|🔔 Напоминания снова приходят\.)$/u

export function toggledText(text: string, note: string): string {
  return `${text.replace(NOTE, '')}\n\n${note}`
}

/**
 * Нажали кнопку. Порядок здесь важнее обычного: сначала запись в базу, потом
 * ответ. Не дойдёт ответ — родитель увидит прежнюю кнопку, но отписан уже
 * будет; сделай наоборот — и упавший запрос оставил бы его подписанным при
 * сообщении «отключены».
 */
async function onCallback(bot: Bot, update: MaxUpdate) {
  const callback = update.callback
  const payload = callback?.payload
  // Кнопку нажимает получатель напоминания, поэтому у сообщения он в
  // `recipient`, а не в `sender` — там бот.
  const userId = userOf(callback?.user?.user_id ?? update.message?.recipient?.user_id)

  if (!callback?.callback_id || !userId || (payload !== STOP && payload !== RESUME)) {
    // Форма события не та, что мы читаем. Молча пропустить значит потом
    // полдня искать, почему кнопка «не работает».
    console.warn(`max[${bot.key}]: непонятное нажатие —`, JSON.stringify(update))
    return
  }

  const stopping = payload === STOP
  const scope = scopeOf(bot)
  const count = stopping
    ? await unsubscribeAll(prisma, scope, userId)
    : await resubscribeAll(prisma, scope, userId)
  console.log(
    `max[${bot.key}]: user ${userId} кнопка «${stopping ? 'Не напоминать' : 'Вернуть'}» — ` +
      `${stopping ? 'отписано' : 'возвращено'} ${count}`,
  )

  const text = toggledText(update.message?.body?.text ?? '', stopping ? OFF_NOTE : ON_NOTE)
  const result = await answerCallback(bot.token, callback.callback_id, text, [
    stopping ? RESUME_BUTTON : STOP_BUTTON,
  ])

  if (!result.ok) console.error(`max[${bot.key}]: ответ на нажатие не ушёл —`, result.error)
}

async function onMessage(bot: Bot, update: MaxUpdate) {
  const userId = userOf(update.message?.sender?.user_id)
  if (!userId) return

  const body = update.message?.body
  const phone = readPhone(body?.attachments)

  if (phone) {
    const parents = await bindByPhone(prisma, scopeOf(bot), userId, phone)
    console.log(
      `max[${bot.key}]: user ${userId} номер …${phone.slice(-4)} — ` +
        (parents.length > 0 ? `найдено родителей: ${parents.length}` : 'никого'),
    )

    if (parents.length === 0) {
      reply(bot, userId, NOT_FOUND, true)
      return
    }

    reply(
      bot,
      userId,
      await buildBindSummary(
        prisma,
        parents.map((parent) => parent.parentId),
      ),
    )
    return
  }

  await onCommand(bot, userId, body?.text ?? '')
}

/**
 * Три команды меню. Аккаунт без единой привязки на любую из них получает
 * приветствие с кнопкой: отключать, включать и открывать ему нечего, а начать
 * — есть с чего.
 */
async function onCommand(bot: Bot, userId: string, text: string) {
  const command = readCommand(text)
  if (!command) return

  const scope = scopeOf(bot)
  const bindings = await readBindings(prisma, scope, userId)
  if (bindings.length === 0) {
    reply(bot, userId, ASK, true)
    return
  }

  if (command === 'cabinet') {
    reply(bot, userId, cabinetText(bindings))
    return
  }

  if (command === 'stop') {
    const count = await unsubscribeAll(prisma, scope, userId)
    console.log(`max[${bot.key}]: user ${userId} /stop — отписано ${count}`)
    reply(bot, userId, count > 0 ? STOPPED : ALREADY_STOPPED)
    return
  }

  const count = await resubscribeAll(prisma, scope, userId)
  console.log(`max[${bot.key}]: user ${userId} /resume — возвращено ${count}`)
  reply(bot, userId, count > 0 ? RESUMED : ALREADY_ACTIVE)
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
function reply(bot: Bot, userId: string, text: string, withButton = false) {
  const send = withButton
    ? askForContact(bot.token, userId, text)
    : sendMessage(bot.token, userId, text)
  void send
    .then((result) => {
      if (!result.ok) console.error(`max[${bot.key}]: ответ родителю не ушёл —`, result.error)
    })
    .catch((error) => {
      console.error(`max[${bot.key}]: ответ родителю не ушёл`, error)
    })
}
