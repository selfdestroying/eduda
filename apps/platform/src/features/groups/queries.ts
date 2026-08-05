import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  addStudentToGroup,
  addTeacherToGroup,
  archiveGroup,
  completeGroup,
  countFutureLessons,
  createGroup,
  createLessonForGroup,
  deleteGroup,
  dismissStudentFromGroup,
  editTeacherGroup,
  getGroup,
  getGroupDetail,
  getGroups,
  removeStudentFromGroup,
  removeTeacherFromGroup,
  transferStudent,
  updateGroup,
  updateScheduleAndRegenerateLessons,
  updateScheduleOnly,
} from './actions'
import type {
  AddStudentToGroupSchemaType,
  AddTeacherToGroupSchemaType,
  ArchiveGroupSchemaType,
  CompleteGroupSchemaType,
  CreateGroupSchemaType,
  CreateLessonForGroupSchemaType,
  DeleteGroupSchemaType,
  DeleteStudentGroupSchemaType,
  DeleteTeacherGroupSchemaType,
  DismissStudentSchemaType,
  EditTeacherGroupSchemaType,
  TransferStudentSchemaType,
  UpdateGroupSchemaType,
  UpdateScheduleAndLessonsSchemaType,
  UpdateScheduleOnlySchemaType,
} from './schemas'

export const groupKeys = {
  all: ['groups'] as const,
  detail: (id: number) => ['groups', 'detail', id] as const,
  futureLessonsCount: (groupId: number) => ['groups', 'futureLessonsCount', groupId] as const,
}

// ─── Queries ────────────────────────────────────────────────────────

export const useGroupListQuery = () => {
  return useQuery({
    queryKey: groupKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getGroups()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const useGroupDetailQuery = (id: number) => {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: async () => {
      const { data, serverError } = await getGroup({ id })
      if (serverError) throw serverError
      return data ?? null
    },
  })
}

export const useFutureLessonsCountQuery = (
  groupId: number,
  afterDate?: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: [...groupKeys.futureLessonsCount(groupId), afterDate],
    queryFn: async () => {
      const { data, serverError } = await countFutureLessons({ groupId, afterDate })
      if (serverError) throw serverError
      return data ?? 0
    },
    enabled: options?.enabled,
  })
}

// ─── Mutations ──────────────────────────────────────────────────────

export const useGroupCreateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreateGroupSchemaType) => {
      const { data, serverError } = await createGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      toast.success('Группа успешно создана!')
    },
    onError: () => toast.error('Ошибка при создании группы.'),
  })
}

export const useGroupUpdateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdateGroupSchemaType) => {
      const { data, serverError } = await updateGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.id) })
      toast.success('Группа успешно обновлена!')
    },
    onError: () => toast.error('Ошибка при обновлении группы.'),
  })
}

export const useGroupDeleteMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DeleteGroupSchemaType) => {
      const { data, serverError } = await deleteGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      toast.success('Группа успешно удалена!')
    },
    onError: () => toast.error('Ошибка при удалении группы.'),
  })
}

export const useArchiveGroupMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: ArchiveGroupSchemaType) => {
      const { data, serverError } = await archiveGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
      toast.success('Группа успешно архивирована!')
    },
    onError: () => toast.error('Ошибка при архивации группы.'),
  })
}

export const useCompleteGroupMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CompleteGroupSchemaType) => {
      const { data, serverError } = await completeGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
      toast.success('Группа успешно завершена!')
    },
    onError: () => toast.error('Ошибка при завершении группы.'),
  })
}

export const useScheduleRegenerateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdateScheduleAndLessonsSchemaType) => {
      const { data, serverError } = await updateScheduleAndRegenerateLessons(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
      toast.success('Расписание обновлено, уроки пересозданы!')
    },
    onError: () => {
      toast.error('Ошибка при обновлении расписания.')
    },
  })
}

export const useScheduleUpdateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdateScheduleOnlySchemaType) => {
      const { data, serverError } = await updateScheduleOnly(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
      toast.success('Расписание обновлено!')
    },
    onError: () => toast.error('Ошибка при обновлении расписания.'),
  })
}

// ─── Detail Page Query ──────────────────────────────────────────────

export const useGroupDetailPageQuery = (id: number) => {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: async () => {
      const { data, serverError } = await getGroupDetail({ id })
      if (serverError) throw serverError
      return data ?? null
    },
  })
}

// ─── Student-Group Mutations ────────────────────────────────────────

export const useAddStudentToGroupMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: AddStudentToGroupSchemaType) => {
      const { data, serverError } = await addStudentToGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
      toast.success('Студент успешно добавлен в группу!')
    },
    onError: () => toast.error('Не удалось добавить студента.'),
  })
}

export const useRemoveStudentFromGroupMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DeleteStudentGroupSchemaType) => {
      const { data, serverError } = await removeStudentFromGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
      toast.success('Ученик успешно удалён из группы!')
    },
    onError: () => toast.error('Ошибка при удалении ученика.'),
  })
}

export const useDismissStudentMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DismissStudentSchemaType) => {
      const { data, serverError } = await dismissStudentFromGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
      toast.success('Студент переведён в отток!')
    },
    onError: () => toast.error('Ошибка при переводе в отток.'),
  })
}

export const useTransferStudentMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: TransferStudentSchemaType) => {
      const { data, serverError } = await transferStudent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.oldGroupId) })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.newGroupId) })
      toast.success('Студент успешно переведён!')
    },
    onError: () => toast.error('Ошибка при переводе студента.'),
  })
}

// ─── Teacher-Group Mutations ────────────────────────────────────────

export const useAddTeacherToGroupMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: AddTeacherToGroupSchemaType) => {
      const { data, serverError } = await addTeacherToGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
      toast.success('Преподаватель успешно добавлен!')
    },
    onError: () => toast.error('Не удалось добавить преподавателя.'),
  })
}

export const useEditTeacherGroupMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: EditTeacherGroupSchemaType) => {
      const { data, serverError } = await editTeacherGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
      toast.success('Ставка успешно обновлена!')
    },
    onError: () => toast.error('Ошибка при обновлении ставки.'),
  })
}

export const useRemoveTeacherFromGroupMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DeleteTeacherGroupSchemaType) => {
      const { data, serverError } = await removeTeacherFromGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
      toast.success('Преподаватель успешно удалён!')
    },
    onError: () => toast.error('Ошибка при удалении преподавателя.'),
  })
}

// ─── Lesson Mutation ────────────────────────────────────────────────

export const useCreateLessonForGroupMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreateLessonForGroupSchemaType) => {
      const { data, serverError } = await createLessonForGroup(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
      toast.success('Занятие успешно добавлено!')
    },
    onError: () => toast.error('Ошибка при добавлении занятия.'),
  })
}
