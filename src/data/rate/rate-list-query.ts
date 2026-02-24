import { getRates } from '@/src/actions/rates'
import { useQuery } from '@tanstack/react-query'
import { rateKeys } from './keys'

export async function getRateList(organizationId: number) {
  return await getRates({
    where: { organizationId },
    include: { _count: { select: { teacherGroups: true } } },
    orderBy: { name: 'asc' },
  })
}

export type RateListData = Awaited<ReturnType<typeof getRateList>>

export const useRateListQuery = (organizationId: number) => {
  return useQuery({
    queryKey: rateKeys.list(organizationId),
    queryFn: () => getRateList(organizationId),
    enabled: !!organizationId,
  })
}

export const useMappedRateListQuery = (organizationId: number) => {
  return useQuery({
    queryKey: rateKeys.list(organizationId),
    queryFn: () => getRateList(organizationId),
    enabled: !!organizationId,
    select: (rates) =>
      rates.map((rate) => ({
        value: rate.id.toString(),
        label:
          rate.bonusPerStudent > 0
            ? `${rate.name} (${rate.bid} ₽ + ${rate.bonusPerStudent} ₽/уч.)`
            : `${rate.name} (${rate.bid} ₽)`,
      })),
  })
}
