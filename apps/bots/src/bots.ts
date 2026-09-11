import { readSchoolBotTokens, type SchoolBotToken } from '@repo/core/max-bots'
import type { Prisma } from '@repo/db'
import { createHmac } from 'node:crypto'
import { env } from './env'

/**
 * Боты MAX, которыми рассылает установка: бот ЕДУДА из `.env` и собственные
 * боты школ из `OrganizationMaxBot`.
 *
 * Бот определяется не по событию, а по адресу: в апдейте MAX нет признака
 * бота, поэтому у бота школы свой вебхук — `/max/<organizationId>`.
 */

export type Bot = {
  /** Для логов: «ЕДУДА» или «школа 9». */
  key: string
  /** `null` — бот ЕДУДА. */
  organizationId: number | null
  token: string
  webhookUrl: string
  secret: string
}

/**
 * Какие привязки принадлежат боту. Бот школы видит только её родителей: токен
 * его у школы, и всё, что уходит через него, — в том числе ссылки на кабинеты —
 * читает она сама.
 */
export type BotScope = { ownBot: false } | { ownBot: true; organizationId: number }

export function scopeOf(bot: Bot): BotScope {
  return bot.organizationId === null
    ? { ownBot: false }
    : { ownBot: true, organizationId: bot.organizationId }
}

function defaultBot(): Bot | null {
  return env.max.token
    ? {
        key: 'ЕДУДА',
        organizationId: null,
        token: env.max.token,
        webhookUrl: env.max.webhookUrl,
        secret: env.max.secret,
      }
    : null
}

/**
 * Секрет вебхука бота школы. Не хранится, а выводится из общего секрета: MAX
 * присылает его в заголовке, и сверять надо с тем, что мы же ему отдали при
 * подписке. Хранить нечего — и утечь из базы нечему.
 *
 * Hex, потому что MAX принимает в секрете только `A-Za-z0-9-`.
 */
export function schoolWebhookSecret(organizationId: number): string {
  return createHmac('sha256', env.max.secret).update(`org:${organizationId}`).digest('hex')
}

function schoolBot({ organizationId, token }: SchoolBotToken): Bot {
  return {
    key: `школа ${organizationId}`,
    organizationId,
    token,
    webhookUrl: `${env.max.webhookUrl}/${organizationId}`,
    secret: schoolWebhookSecret(organizationId),
  }
}

/** Все боты установки: ЕДУДА, если заведён, и боты школ, чьи токены читаются. */
export async function listBots(db: Prisma.TransactionClient): Promise<Bot[]> {
  const schools = (await readSchoolBotTokens(db)).map(schoolBot)
  const eduda = defaultBot()
  return eduda ? [eduda, ...schools] : schools
}

/**
 * Бот по адресу вебхука: `/max` — ЕДУДА, `/max/<id>` — бот школы. `null` —
 * такого бота нет: не заведён, школа его отключила или токен не читается.
 */
export async function botByPath(
  db: Prisma.TransactionClient,
  pathname: string,
): Promise<Bot | null> {
  const match = /^\/max(?:\/(\d+))?$/.exec(pathname)
  if (!match) return null
  if (!match[1]) return defaultBot()

  const [school] = await readSchoolBotTokens(db, { organizationId: Number(match[1]) })
  return school ? schoolBot(school) : null
}
