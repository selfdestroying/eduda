import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createCourse, deleteCourse, getCourses, updateCourse } from './actions'
import { CreateCourseSchemaType, DeleteCourseSchemaType, UpdateCourseSchemaType } from './schemas'

export const courseKeys = {
  all: ['courses'] as const,
  lists: () => [...courseKeys.all, 'list'] as const,
}

const getCourseList = async () => {
  const { data, serverError } = await getCourses()

  if (serverError) {
    throw serverError
  }

  return data ?? []
}

export const useCourseListQuery = () => {
  return useQuery({
    queryKey: courseKeys.all,
    queryFn: getCourseList,
  })
}

export const useMappedCourseListQuery = () => {
  return useQuery({
    queryKey: courseKeys.all,
    queryFn: getCourseList,
    select: (courses) =>
      courses.map((course) => ({
        value: course.id.toString(),
        label: course.name,
      })),
  })
}

export const useCourseCreateMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: CreateCourseSchemaType) => {
      const { data, serverError } = await createCourse(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseKeys.all })
      toast.success('Курс успешно создан!')
    },
    onError: () => {
      toast.error('Ошибка при создании курса.')
    },
  })
}

export const useCourseUpdateMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: UpdateCourseSchemaType) => {
      const { data, serverError } = await updateCourse(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseKeys.all })
      toast.success('Курс успешно обновлён!')
    },
    onError: () => {
      toast.error('Ошибка при обновлении курса.')
    },
  })
}

export const useCourseDeleteMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: DeleteCourseSchemaType) => {
      const { data, serverError } = await deleteCourse(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseKeys.all })
      toast.success('Курс успешно удалён!')
    },
    onError: () => {
      toast.error('Не удалось удалить курс.')
    },
  })
}
