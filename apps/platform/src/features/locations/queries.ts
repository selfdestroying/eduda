import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createLocation, deleteLocation, getLocations, updateLocation } from './actions'
import {
  CreateLocationSchemaType,
  DeleteLocationSchemaType,
  UpdateLocationSchemaType,
} from './schemas'

export const locationKeys = {
  all: ['locations'] as const,
  lists: () => [...locationKeys.all, 'list'] as const,
}

const getLocationList = async () => {
  const { data, serverError } = await getLocations()

  if (serverError) {
    throw serverError
  }

  return data ?? []
}

export const useLocationListQuery = () => {
  return useQuery({
    queryKey: locationKeys.all,
    queryFn: getLocationList,
  })
}

export const useMappedLocationListQuery = () => {
  return useQuery({
    queryKey: locationKeys.all,
    queryFn: getLocationList,
    select: (locations) =>
      locations.map((location) => ({
        value: location.id.toString(),
        label: location.name,
      })),
  })
}

export const useLocationCreateMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: CreateLocationSchemaType) => {
      const { data, serverError } = await createLocation(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all })
      toast.success('Локация успешно создана!')
    },
    onError: () => {
      toast.error('Ошибка при создании локации.')
    },
  })
}

export const useLocationUpdateMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: UpdateLocationSchemaType) => {
      const { data, serverError } = await updateLocation(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all })
      toast.success('Локация успешно обновлена!')
    },
    onError: () => {
      toast.error('Ошибка при обновлении локации.')
    },
  })
}

export const useLocationDeleteMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: DeleteLocationSchemaType) => {
      const { data, serverError } = await deleteLocation(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.all })
      toast.success('Локация успешно удалена!')
    },
    onError: () => {
      toast.error('Не удалось удалить локацию.')
    },
  })
}
