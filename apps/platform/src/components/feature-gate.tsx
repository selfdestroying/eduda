'use client'

import { useFeatureEnabled } from '@/src/hooks/use-feature-enabled'
import type { FeatureKey } from '@/src/lib/features/registry'
import type { ReactNode } from 'react'

interface FeatureGateProps {
  feature: FeatureKey
  children: ReactNode
  fallback?: ReactNode
}

/** Renders children only if the feature is enabled for the current organization */
export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const enabled = useFeatureEnabled(feature)
  return enabled ? children : fallback
}
