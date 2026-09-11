import { BAD_SIGNATURE, matchInitData } from '@/src/lib/max-init-data'
import { readSchoolBotTokens } from '@repo/core/max-bots'
import { prisma } from '@repo/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Вход в кабинет из мини-приложения MAX.
 *
 * Страница `/max` присылает сюда `window.WebApp.initData`, роут проверяет
 * подпись и отвечает списком кабинетов этого MAX-аккаунта. Строка запуска
 * приходит из фрагмента URL и до сервера сама не доезжает — отсюда лишний шаг
 * через клиент, без него данных запуска у сервера просто нет.
 *
 * Мини-приложение открывают из бота ЕДУДА и из ботов школ, и подпись у каждого
 * своя. Какой бот подписал, видно по тому, чей токен сошёлся, — и кабинеты
 * отдаются только привязок к этому боту. Иначе нельзя: токен бота школы у самой
 * школы, она может подписать строку за любого пользователя MAX и без этого
 * отбора открыла бы кабинеты родителей других школ.
 *
 * Кабинетов бывает несколько: у родителя дети бывают в разных школах — это
 * разные `Parent` с одним номером телефона.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { initData?: unknown } | null
  if (typeof body?.initData !== 'string') {
    return NextResponse.json({ error: 'нет данных запуска' }, { status: 400 })
  }

  const candidates = await botCandidates()
  if (candidates.length === 0) {
    // Токен — единственный способ проверить подпись. Без него пускать в кабинет
    // по неподтверждённому `user.id` нельзя, поэтому отказ, а не «как-нибудь».
    console.warn('max/enter: проверить подпись нечем — нет ни бота ЕДУДА, ни ботов школ')
    return NextResponse.json({ error: 'MAX не настроен' }, { status: 503 })
  }

  const match = matchInitData(body.initData, candidates)
  if (!match || !match.result.ok) {
    const reason = match && !match.result.ok ? match.result.reason : BAD_SIGNATURE
    console.warn(`max/enter: отказ — ${reason}`)
    return NextResponse.json({ error: reason }, { status: 401 })
  }

  const { candidate, result } = match

  // Отписка от напоминаний здесь не фильтр: «не пишите мне» — это про
  // сообщения, а не про доступ к своему же кабинету.
  const messengers = await prisma.parentMessenger.findMany({
    where: {
      provider: 'MAX',
      externalId: result.user.id,
      ...(candidate.organizationId === null
        ? { ownBot: false }
        : { ownBot: true, organizationId: candidate.organizationId }),
    },
    select: {
      parent: {
        select: {
          firstName: true,
          accessToken: true,
          organization: { select: { name: true } },
        },
      },
    },
    orderBy: { organizationId: 'asc' },
  })

  return NextResponse.json({
    cabinets: messengers.map(({ parent }) => ({
      token: parent.accessToken,
      parent: parent.firstName,
      organization: parent.organization.name,
    })),
  })
}

/** Боты, из которых могли открыть мини-приложение: ЕДУДА и боты школ. */
async function botCandidates(): Promise<Array<{ token: string; organizationId: number | null }>> {
  const schools = await readSchoolBotTokens(prisma)
  const eduda = process.env.MAX_BOT_TOKEN

  return eduda ? [{ token: eduda, organizationId: null }, ...schools] : schools
}
