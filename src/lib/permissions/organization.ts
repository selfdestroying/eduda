import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements, ownerAc } from 'better-auth/plugins/organization/access'

const statement = {
  ...defaultStatements,
  member: ['read', 'create', 'update', 'delete'],
  group: ['create', 'read', 'update', 'delete'],
  lesson: ['create', 'readSelf', 'readAll', 'update', 'delete'],
  student: ['create', 'read', 'update', 'delete'],
  payment: ['create', 'read', 'update', 'delete'],
  paycheck: ['create', 'read', 'update', 'delete'],
  salary: ['readSelf', 'readAll'],

  rate: ['create', 'read', 'update', 'delete'],
  groupType: ['create', 'read', 'update', 'delete'],
  teacherGroup: ['create', 'read', 'update', 'delete'],
  teacherLesson: ['create', 'read', 'update', 'delete'],
  studentGroup: ['create', 'read', 'update', 'delete'],
  studentLesson: ['create', 'read', 'update', 'delete', 'selectWarned'],

  lessonStudentHistory: ['read', 'update'],
} as const

const ac = createAccessControl(statement)

const teacher = ac.newRole({
  group: ['read'],
  lesson: ['readSelf'],
  student: ['read'],
  payment: ['read'],
  paycheck: ['read'],
  salary: ['readSelf'],

  rate: ['read'],
  groupType: ['read'],
  teacherGroup: ['read'],
  studentGroup: ['read'],
  teacherLesson: ['read'],
  studentLesson: ['read', 'update'],
})

const manager = ac.newRole({
  group: ['create', 'read', 'update', 'delete'],
  lesson: ['create', 'readSelf', 'readAll', 'update', 'delete'],
  student: ['create', 'read', 'update', 'delete'],
  payment: ['create', 'read', 'update', 'delete'],
  paycheck: ['create', 'read', 'update', 'delete'],
  member: ['read', 'create', 'update', 'delete'],
  salary: ['readSelf', 'readAll'],

  rate: ['create', 'read', 'update', 'delete'],
  groupType: ['create', 'read', 'update', 'delete'],
  teacherGroup: ['create', 'read', 'update', 'delete'],
  studentGroup: ['create', 'read', 'update', 'delete'],
  teacherLesson: ['create', 'read', 'update', 'delete'],
  studentLesson: ['create', 'read', 'update', 'delete', 'selectWarned'],

  lessonStudentHistory: ['read', 'update'],
})

const owner = ac.newRole({
  ...ownerAc.statements,
  ...manager.statements,
  organization: ['update'],
})

export type OrganizationStatementKeys = keyof typeof statement
export type OrganizationAction<T extends OrganizationStatementKeys> = (typeof statement)[T][number]
export type OrganizationPermissionCheck = {
  [R in OrganizationStatementKeys]?: Array<OrganizationAction<R>>
}

export default { ac, roles: { owner, manager, teacher } }
