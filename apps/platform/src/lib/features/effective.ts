import 'server-only'

import { disabledFeaturesOf } from '@repo/core/features-db'
import { prisma } from '@repo/db'

/**
 * Единственная точка резолва эффективного набора фич организации — для
 * платформы. Сама реализация переехала в `@repo/core/features-db`: тот же
 * резолв нужен планировщику напоминаний в `apps/bots`, а этот модуль
 * `server-only` и импортироваться оттуда не может.
 *
 * Позже (монетизация) правка идёт в пакет — и остаётся одной. Все потребители
 * здесь (proxy, `featureAction`, `<FeatureGate>`) читают результат через
 * снапшот сессии `session.disabledFeatures`, поэтому распространение расширять
 * не нужно.
 */
export async function getEffectiveFeatures(
  organizationId: number | null,
): Promise<{ disabledFeatures: string[] }> {
  return { disabledFeatures: await disabledFeaturesOf(prisma, organizationId) }
}
