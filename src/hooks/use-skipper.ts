import { useCallback, useEffect, useRef } from 'react'

export default function useSkipper() {
  const shouldSkipRef = useRef(true)

  const shouldSkip = shouldSkipRef.current

  const skip = useCallback(() => {
    shouldSkipRef.current = false
  }, [])

  useEffect(() => {
    shouldSkipRef.current = true
  })

  return [shouldSkip, skip] as const
}
