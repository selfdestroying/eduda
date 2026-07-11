'use client'

import { useSessionQuery } from '@/src/features/users/me/queries'
import { type FeatureKey, isFeatureDisabled } from '@/src/lib/features/registry'

/** Check if a feature is enabled for the current organization */
export function useFeatureEnabled(featureKey: FeatureKey): boolean {
  const { data: session } = useSessionQuery()
  const disabledFeatures = (session?.disabledFeatures as string[] | undefined) ?? []
  return !isFeatureDisabled(disabledFeatures, featureKey)
}
