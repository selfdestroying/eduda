import 'server-only'

import prisma from '../db/prisma'

/**
 * Единственная точка резолва эффективного набора фич организации.
 *
 * Сейчас: возвращает только оверрайды из `OrganizationFeature` (enabled = false).
 * Позже (монетизация): здесь встанет `фичи_плана(plan) ± оверрайды` — и это будет
 * единственное место правки. Все потребители (proxy, `featureAction`, `<FeatureGate>`)
 * читают результат через снапшот сессии `session.disabledFeatures`, поэтому расширять
 * распространение не нужно — только эту функцию.
 */
export async function getEffectiveFeatures(
  organizationId: number | null,
): Promise<{ disabledFeatures: string[] }> {
  if (!organizationId) {
    return { disabledFeatures: [] }
  }

  const overrides = await prisma.organizationFeature.findMany({
    where: { organizationId, enabled: false },
    select: { featureKey: true },
  })

  return { disabledFeatures: overrides.map((f) => f.featureKey) }
}
