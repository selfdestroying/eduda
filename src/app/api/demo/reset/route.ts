import { seedDemoOrg } from '@/src/features/demo/seed'
import { NextResponse } from 'next/server'

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

export const GET = handle
