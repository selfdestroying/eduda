'use client'

import TableFilter, { TableFilterItem } from '@/src/components/table-filter'
import { FieldGroup } from '@/src/components/ui/field'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useMappedCourseListQuery } from '@/src/data/course/course-list-query'
import { useMappedLocationListQuery } from '@/src/data/location/location-list-query'
import { useMappedMemberListQuery } from '@/src/data/member/member-list-query'
import { ColumnFiltersState } from '@tanstack/react-table'
import { useCallback, useMemo } from 'react'

interface CourseLocationTeacherFiltersProps {
  organizationId: number
  columnFilters: ColumnFiltersState
  setFilters: (
    updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState),
  ) => void
  /** ID заблокированного преподавателя (для ограниченных прав) */
  lockedTeacherId?: string | number
  /** Отключить выбор преподавателя */
  disableTeacherFilter?: boolean
  /** Обернуть в FieldGroup (для вертикальной раскладки, напр. Dashboard) */
  wrapInFieldGroup?: boolean
}

/**
 * Общий компонент фильтров Курс / Локация / Преподаватель.
 * Используется в ActiveStudents, DismissedStudents и Dashboard.
 */
export default function CourseLocationTeacherFilters({
  organizationId,
  columnFilters,
  setFilters,
  lockedTeacherId,
  disableTeacherFilter,
  wrapInFieldGroup,
}: CourseLocationTeacherFiltersProps) {
  const { data: courses, isLoading: isCoursesLoading } = useMappedCourseListQuery(organizationId)
  const { data: locations, isLoading: isLocationsLoading } =
    useMappedLocationListQuery(organizationId)
  const { data: mappedUsers, isLoading: isMembersLoading } =
    useMappedMemberListQuery(organizationId)

  const handleCourseFilterChange = useCallback(
    (selectedCourses: TableFilterItem[]) => {
      const courseIds = selectedCourses.map((course) => Number(course.value))
      setFilters((old) => {
        const otherFilters = old.filter((filter) => filter.id !== 'course')
        return [...otherFilters, { id: 'course', value: courseIds }]
      })
    },
    [setFilters],
  )

  const handleLocationFilterChange = useCallback(
    (selectedLocations: TableFilterItem[]) => {
      const locationIds = selectedLocations.map((location) => Number(location.value))
      setFilters((old) => {
        const otherFilters = old.filter((filter) => filter.id !== 'location')
        return [...otherFilters, { id: 'location', value: locationIds }]
      })
    },
    [setFilters],
  )

  const handleTeacherFilterChange = useCallback(
    (selectedUsers: TableFilterItem[]) => {
      if (disableTeacherFilter) return
      const userIds = selectedUsers.map((user) => Number(user.value))
      setFilters((old) => {
        const otherFilters = old.filter((filter) => filter.id !== 'teacher')
        return [...otherFilters, { id: 'teacher', value: userIds }]
      })
    },
    [setFilters, disableTeacherFilter],
  )

  const lockedTeacherValue =
    lockedTeacherId && mappedUsers
      ? mappedUsers.find((user) => user.value === lockedTeacherId.toString())
      : undefined

  // Derive selected values from columnFilters for each filter
  const selectedCourses = useMemo(() => {
    const filter = columnFilters.find((f) => f.id === 'course')
    if (!filter || !courses) return []
    const ids = filter.value as number[]
    return courses.filter((c) => ids.includes(Number(c.value)))
  }, [columnFilters, courses])

  const selectedLocations = useMemo(() => {
    const filter = columnFilters.find((f) => f.id === 'location')
    if (!filter || !locations) return []
    const ids = filter.value as number[]
    return locations.filter((l) => ids.includes(Number(l.value)))
  }, [columnFilters, locations])

  const selectedTeachers = useMemo(() => {
    if (lockedTeacherValue) return [lockedTeacherValue]
    const filter = columnFilters.find((f) => f.id === 'teacher')
    if (!filter || !mappedUsers) return []
    const ids = filter.value as number[]
    return mappedUsers.filter((u) => ids.includes(Number(u.value)))
  }, [columnFilters, mappedUsers, lockedTeacherValue])

  if (isCoursesLoading || isLocationsLoading || isMembersLoading) {
    const skeletons = (
      <>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </>
    )
    return wrapInFieldGroup ? <FieldGroup>{skeletons}</FieldGroup> : skeletons
  }

  const content = (
    <>
      {courses ? (
        <TableFilter
          label="Курс"
          items={courses}
          value={selectedCourses}
          onChange={handleCourseFilterChange}
        />
      ) : (
        <Skeleton className="h-8 w-full" />
      )}
      {locations ? (
        <TableFilter
          label="Локация"
          items={locations}
          value={selectedLocations}
          onChange={handleLocationFilterChange}
        />
      ) : (
        <Skeleton className="h-8 w-full" />
      )}
      {mappedUsers ? (
        <TableFilter
          label="Преподаватель"
          items={mappedUsers}
          onChange={handleTeacherFilterChange}
          disabled={disableTeacherFilter}
          value={selectedTeachers}
        />
      ) : (
        <Skeleton className="h-8 w-full" />
      )}
    </>
  )

  return wrapInFieldGroup ? <FieldGroup>{content}</FieldGroup> : content
}
