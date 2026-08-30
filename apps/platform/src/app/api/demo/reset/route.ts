import { seedDemoOrg } from '@/src/features/demo/seed'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Пересоздаёт демо-организацию. Тот же роут используется:
 *  - планировщиком для периодического сброса;
 *  - вручную для первичного посева.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle() {
  const { organizationId } = await seedDemoOrg()
  return NextResponse.json({ ok: true, organizationId })
}

export async function GET(request: NextRequest) {
  // Роут выставлен наружу вместе со всем приложением (nginx проксирует `/`
  // целиком на каждом поддомене), а `seedDemoOrg` сносит организацию и создаёт
  // её заново каскадом. Без ключа это публичная кнопка «удалить демо-школу», и
  // на одном ядре — ещё и способ занять процесс минутой работы на каждый вызов.
  //
  // Ключа в `.env` нет — роут не работает вовсе. Отказ по умолчанию здесь
  // правильнее: незапущенный сброс демо заметит один человек, открытый — все.
  const key = process.env.DEMO_RESET_KEY
  if (!key || request.headers.get('x-demo-key') !== key) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  return handle()
}
