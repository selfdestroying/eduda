import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  disconnectMessenger,
  getCabinetMessengers,
  getReminderLog,
  getReminderParents,
  getReminderSettings,
  updateReminderSettings,
} from './actions'
import type {
  DisconnectMessengerSchemaType,
  ReminderLogListSchemaType,
  ReminderParentListSchemaType,
  ReminderSettingsSchemaType,
} from './schemas'

export const notificationKeys = {
  messengers: (token: string) => ['notifications', token, 'messengers'] as const,
  settings: () => ['notifications', 'settings'] as const,
  overview: ['notifications', 'overview'] as const,
}

export const useCabinetMessengersQuery = (token: string) => {
  return useQuery({
    queryKey: notificationKeys.messengers(token),
    queryFn: async () => {
      const { data, serverError } = await getCabinetMessengers({ token })
      if (serverError) throw serverError
      return data ?? null
    },
  })
}

export const useDisconnectMessengerMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DisconnectMessengerSchemaType) => {
      const { data, serverError } = await disconnectMessenger(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.messengers(variables.token) })
      toast.success('Напоминания отключены.')
    },
    onError: () => toast.error('Не удалось отключить напоминания. Попробуйте ещё раз.'),
  })
}

// ─── Настройки школы ────────────────────────────────────────────────

export const useReminderSettingsQuery = () => {
  return useQuery({
    queryKey: notificationKeys.settings(),
    queryFn: async () => {
      const { data, serverError } = await getReminderSettings()
      if (serverError) throw serverError
      return data ?? null
    },
  })
}

export const useUpdateReminderSettingsMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: ReminderSettingsSchemaType) => {
      const { data, serverError } = await updateReminderSettings(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.settings() })
      toast.success('Настройки напоминаний сохранены.')
    },
    onError: () => toast.error('Не удалось сохранить настройки. Попробуйте ещё раз.'),
  })
}

// ─── Экран школы ────────────────────────────────────────────────────

const EMPTY_PAGE = { rows: [], total: 0 }

export const useReminderParentsQuery = (params: ReminderParentListSchemaType) =>
  useQuery({
    queryKey: [...notificationKeys.overview, 'parents', params],
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getReminderParents(params)
      if (serverError) throw serverError
      // Без этой ветки невалидный URL даёт `data === undefined` и надпись
      // «Нет родителей» — как будто записей и правда нет.
      if (validationErrors) throw new Error('Некорректные параметры выборки')
      return data ?? EMPTY_PAGE
    },
    placeholderData: keepPreviousData,
  })

export const useReminderLogQuery = (params: ReminderLogListSchemaType) =>
  useQuery({
    queryKey: [...notificationKeys.overview, 'log', params],
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getReminderLog(params)
      if (serverError) throw serverError
      if (validationErrors) throw new Error('Некорректные параметры выборки')
      return data ?? EMPTY_PAGE
    },
    placeholderData: keepPreviousData,
  })
