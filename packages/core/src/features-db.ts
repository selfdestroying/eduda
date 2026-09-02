import type { Prisma } from '@repo/db'
import { isFeatureDisabled } from './features'

/**
 * Резолв эффективного набора фич школы из базы — единственная реализация.
 *
 * Живёт в пакете, а не в платформе, потому что читателей теперь двое:
 * платформа (`lib/features/effective.ts`, гейты в actions и proxy) и
 * планировщик напоминаний в `apps/bots`, который пропускает школы с
 * выключенными уведомлениями. Импортировать платформенный модуль оттуда
 * нельзя — он `server-only`, а вторая копия запроса разъехалась бы с первой
 * ровно в тот день, когда сюда приедет тариф.
 *
 * Сейчас это только оверрайды (`enabled = false`); при монетизации здесь
 * встанет `фичи_плана(plan) ± оверрайды` — и это по-прежнему будет одно место.
 */
export async function disabledFeaturesOf(
  db: Prisma.TransactionClient,
  organizationId: number | null,
): Promise<string[]> {
  if (!organizationId) return []

  const overrides = await db.organizationFeature.findMany({
    where: { organizationId, enabled: false },
    select: { featureKey: true },
  })

  return overrides.map((override) => override.featureKey)
}

/** То же, но когда интересна одна фича: учитывает и родительскую. */
export async function isOrgFeatureDisabled(
  db: Prisma.TransactionClient,
  organizationId: number | null,
  featureKey: string,
): Promise<boolean> {
  return isFeatureDisabled(await disabledFeaturesOf(db, organizationId), featureKey)
}
