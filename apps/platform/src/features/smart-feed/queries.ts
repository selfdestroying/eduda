import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createSnoozedAlert,
  createSnoozedAlertsBulk,
  getAbsentStreak as getAbsentStreaks,
  getLowBalance,
  getSnoozedAlerts,
  getUnmarkedAttendance,
  restoreSnoozedAlert,
  restoreSnoozedAlertsBulk,
} from './actions'
import {
  RestoreSnoozedAlertSchemaType,
  RestoreSnoozedAlertsBulkSchemaType,
  SnoozeAlertSchemaType,
  SnoozeAlertsBulkSchemaType,
} from './schemas'

export const smartFeedKeys = {
  all: ['smart-feed'] as const,
  page: ['smart-feed', 'page'] as const,
  absentStreak: ['smart-feed', 'absent-streak'] as const,
  unmarkedAttendance: ['smart-feed', 'unmarked-attendance'] as const,
  lowBalance: ['smart-feed', 'low-balance'] as const,
  snoozed: (entityKey?: string) =>
    ['smart-feed', 'snoozed', ...(entityKey ? [entityKey] : [])] as const,
}

export const useAbsentStreaksQuery = () => {
  return useQuery({
    queryKey: smartFeedKeys.absentStreak,
    queryFn: async () => {
      const { data, serverError } = await getAbsentStreaks({ withSnoozed: false })
      if (serverError) throw serverError
      return data
    },
    refetchInterval: 5 * 60 * 1000, // refetch every 5 minutes
  })
}

export const useUnmarkedAttendnace = () => {
  return useQuery({
    queryKey: smartFeedKeys.unmarkedAttendance,
    queryFn: async () => {
      const { data, serverError } = await getUnmarkedAttendance()
      if (serverError) throw serverError
      return data
    },
    refetchInterval: 5 * 60 * 1000, // refetch every 5 minutes
  })
}

export const useLowBalanceQuery = () => {
  return useQuery({
    queryKey: smartFeedKeys.lowBalance,
    queryFn: async () => {
      const { data, serverError } = await getLowBalance({ withSnoozed: false })
      if (serverError) throw serverError
      return data
    },
    refetchInterval: 5 * 60 * 1000, // refetch every 5 minutes
  })
}

export const useSnoozedAlertsQuery = (entityKey?: string) => {
  return useQuery({
    queryKey: smartFeedKeys.snoozed(entityKey),
    queryFn: async () => {
      const { data, serverError } = await getSnoozedAlerts(entityKey ? { entityKey } : undefined)
      if (serverError) throw serverError
      return data ?? []
    },
    refetchInterval: 5 * 60 * 1000, // refetch every 5 minutes
  })
}

export const useCreateSnoozedAlertMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SnoozeAlertSchemaType) => {
      const { data, serverError } = await createSnoozedAlert(input)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: smartFeedKeys.all })
      toast.success('Уведомление отложено')
    },
    onError: () => {
      toast.error('Не удалось отложить уведомление')
    },
  })
}

export const useCreateSnoozedAlertsBulkMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SnoozeAlertsBulkSchemaType) => {
      const { data, serverError } = await createSnoozedAlertsBulk(input)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: smartFeedKeys.all })
      toast.success(`Уведомления отложены (${variables.alerts.length})`)
    },
    onError: () => {
      toast.error('Не удалось отложить уведомления')
    },
  })
}

export const useRestoreSnoozedAlertMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RestoreSnoozedAlertSchemaType) => {
      const { data, serverError } = await restoreSnoozedAlert(input)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: smartFeedKeys.all })
      queryClient.invalidateQueries({ queryKey: smartFeedKeys.page })
      toast.success('Уведомление возвращено в активные')
    },
    onError: () => {
      toast.error('Не удалось вернуть уведомление')
    },
  })
}

export const useRestoreSnoozedAlertsBulkMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RestoreSnoozedAlertsBulkSchemaType) => {
      const { data, serverError } = await restoreSnoozedAlertsBulk(input)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: smartFeedKeys.all })
      queryClient.invalidateQueries({ queryKey: smartFeedKeys.page })
      toast.success(`Уведомления возвращены (${variables.alerts.length})`)
    },
    onError: () => {
      toast.error('Не удалось вернуть уведомления')
    },
  })
}
