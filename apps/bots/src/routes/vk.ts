import { bindByRef, isStopCommand, resubscribeAll, unsubscribeAll } from '../bind'
import { env } from '../env'
import { sendMessage } from '../providers/vk'
import type { Reply } from '../reply'

/**
 * Callback API сообщества. VK ждёт ответа около трёх секунд и, не дождавшись,
 * присылает событие снова, поэтому в обработчике только запись в базу — она
 * быстрая и локальная. Ответ родителю в чат уходит уже после `ok`: это сетевой
 * поход наружу, и держать на нём вебхук значит собирать повторы на каждом
 * медленном ответе VK.
 */

type VkEvent = {
  type?: string
  secret?: string
  object?: {
    message?: { from_id?: number; text?: string; payload?: string }
    user_id?: number
  }
}

/** VK принимает ответ только этой строкой; что угодно другое считается сбоем. */
const OK: Reply = { text: 'ok' }

const HINT = 'Подключение делается по персональной ссылке из вашего кабинета — её выдаёт школа.'

const STOPPED =
  'Напоминания отключены. Чтобы включить обратно, снова перейдите по ссылке из кабинета.'

export async function handleVk(raw: string): Promise<Reply> {
  let event: VkEvent
  try {
    event = JSON.parse(raw) as VkEvent
  } catch {
    return { status: 400, text: 'bad request' }
  }

  // Подтверждение сервера идёт до того, как секрет вообще где-то сохранён, и
  // проверять его здесь нечем. Отдавать строку подтверждения безопасно: она не
  // даёт доступа ни к чему, а сообщения шлёт токен, которого у чужого нет.
  if (event.type === 'confirmation') {
    return { text: env.vk.confirmation }
  }

  if (event.secret !== env.vk.secret) {
    // Отказ по секрету — самый тихий способ сломать бота: если `VK_SECRET`
    // задан у нас, но не выставлен в настройках сообщества, VK шлёт события
    // вовсе без него, и снаружи это выглядит как «бот не отвечает». Поэтому в
    // лог, и с разными словами для «не тот» и «его нет».
    console.warn(
      event.secret === undefined
        ? `vk: событие ${event.type} без секрета — проверьте, что VK_SECRET выставлен в настройках сообщества`
        : `vk: событие ${event.type} с чужим секретом — отброшено`,
    )
    return { status: 403, text: 'forbidden' }
  }

  switch (event.type) {
    case 'message_new':
      await onMessage(event)
      return OK

    // Родитель разрешил или запретил сообщения в настройках сообщества, минуя
    // чат. Без этой пары разрешение обратно ничего не включает.
    case 'message_allow':
      await withUser(event, (id) => resubscribeAll('VK', id))
      return OK

    case 'message_deny':
      await withUser(event, (id) => unsubscribeAll('VK', id))
      return OK

    default:
      return OK
  }
}

async function withUser(event: VkEvent, action: (externalId: string) => Promise<unknown>) {
  const userId = event.object?.user_id
  if (typeof userId !== 'number' || userId <= 0) return
  await action(String(userId))
}

async function onMessage(event: VkEvent) {
  const message = event.object?.message
  const fromId = message?.from_id

  // Отрицательный `from_id` — это сообщество, а не человек. Отвечать нечему.
  if (typeof fromId !== 'number' || fromId <= 0) return

  const externalId = String(fromId)
  const text = message?.text ?? ''
  const ref = readRef(message?.payload)

  if (ref) {
    const parent = await bindByRef(ref, externalId)
    reply(
      externalId,
      parent
        ? `Готово, ${parent.firstName}. Напоминания о занятиях будут приходить сюда.\n\nОтключить — команда /stop.`
        : HINT,
    )
    return
  }

  if (isStopCommand(text)) {
    const count = await unsubscribeAll('VK', externalId)
    reply(externalId, count > 0 ? STOPPED : HINT)
    return
  }

  reply(externalId, HINT)
}

/**
 * Метка из ссылки `vk.me/…?ref=<токен>` приезжает в `payload` первого
 * сообщения — JSON-строкой вида `{"ref":"…","ref_source":"…"}`. Тем же полем
 * пользуются кнопки клавиатуры, поэтому читаем осторожно: чужая форма payload
 * не должна ронять обработчик.
 */
function readRef(payload: string | undefined): string | null {
  if (!payload) return null
  try {
    const parsed = JSON.parse(payload) as { ref?: unknown }
    return typeof parsed.ref === 'string' ? parsed.ref : null
  } catch {
    return null
  }
}

/** Ответ в чат — после `ok`, поэтому упавшая отправка только пишется в лог. */
function reply(externalId: string, text: string) {
  void sendMessage(externalId, text).catch((error) => {
    console.error('vk: ответ родителю не ушёл', error)
  })
}
