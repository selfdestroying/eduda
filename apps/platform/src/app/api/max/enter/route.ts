import { verifyInitData } from '@/src/lib/max-init-data'
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
 * Кабинетов бывает несколько: бот один на всю установку, а у родителя дети
 * бывают в разных школах — это разные `Parent` с одним номером телефона.
 */
export async function POST(request: NextRequest) {
  const botToken = process.env.MAX_BOT_TOKEN
  if (!botToken) {
    // Токен — единственный способ проверить подпись. Без него пускать в кабинет
    // по неподтверждённому `user.id` нельзя, поэтому отказ, а не «как-нибудь».
    return NextResponse.json({ error: 'MAX не настроен' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as { initData?: unknown } | null
  if (typeof body?.initData !== 'string') {
    return NextResponse.json({ error: 'нет данных запуска' }, { status: 400 })
  }

  const verified = verifyInitData(body.initData, botToken)
  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 401 })
  }

  // Отписка от напоминаний здесь не фильтр: «не пишите мне» — это про
  // сообщения, а не про доступ к своему же кабинету.
  const messengers = await prisma.parentMessenger.findMany({
    where: { provider: 'MAX', externalId: verified.user.id },
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
