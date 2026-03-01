import { Prisma } from '@/prisma/generated/client'
import { getGroupName } from '@/src/lib/utils'
import { Users } from 'lucide-react'
import Link from 'next/link'
import AddStudentToGroupButton from '../../../groups/[id]/_components/add-student-to-group-button'
import { StudentAttendanceTable } from './attendance-table'
import type { StudentWithGroupsAndAttendance } from './types'

interface StudentGroupsSectionProps {
  student: StudentWithGroupsAndAttendance
  canCreateStudentGroup: boolean
  groups: Prisma.GroupGetPayload<{
    include: {
      location: true
      course: true
      students: true
      schedules: true
      groupType: { include: { rate: true } }
      teachers: { include: { teacher: true } }
    }
  }>[]
}

export default function StudentGroupsSection({
  student,
  groups,
  canCreateStudentGroup,
}: StudentGroupsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
          <Users size={20} />
          Группы
        </h3>
        {canCreateStudentGroup && <AddStudentToGroupButton groups={groups} student={student} />}
      </div>
      {student.groups.length > 0 ? (
        <div className="space-y-6">
          {student.groups.map((groupData) => (
            <div key={groupData.group.id} className="space-y-2">
              <div className="flex items-center gap-3">
                <Link
                  href={`/dashboard/groups/${groupData.group.id}`}
                  className="text-primary hover:underline"
                >
                  {getGroupName(groupData.group)}
                </Link>
              </div>
              <StudentAttendanceTable lessons={groupData.group.lessons} students={[student]} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Ученик не состоит в группах.</p>
      )}
    </div>
  )
}
