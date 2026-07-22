/**
 * Общие константы демо-режима — используются сид-фабрикой, экшенами входа
 * и гвардом. Держим в одном месте, чтобы email'ы/роли не разъезжались.
 */

export const DEMO_SLUG = 'demo'
export const DEMO_ORG_NAME = 'Демо-школа «ЕДУДА»'

export type DemoRole = 'owner' | 'manager' | 'teacher'

export const DEMO_ROLES: readonly DemoRole[] = ['owner', 'manager', 'teacher'] as const

/** Человекочитаемые подписи ролей для UI баннера/лендинга. */
export const DEMO_ROLE_LABELS: Record<DemoRole, string> = {
  owner: 'Владелец',
  manager: 'Менеджер',
  teacher: 'Учитель',
}

interface DemoUserDef {
  email: string
  name: string
  firstName: string
  lastName: string
  /** env-переменная с паролем; при отсутствии берётся дефолт ниже. */
  passwordEnv: string
}

export const DEMO_USERS: Record<DemoRole, DemoUserDef> = {
  owner: {
    email: 'owner@demo.local',
    name: 'Анна Владелец',
    firstName: 'Анна',
    lastName: 'Владелец',
    passwordEnv: 'DEMO_OWNER_PASSWORD',
  },
  manager: {
    email: 'manager@demo.local',
    name: 'Мария Менеджер',
    firstName: 'Мария',
    lastName: 'Менеджер',
    passwordEnv: 'DEMO_MANAGER_PASSWORD',
  },
  teacher: {
    email: 'teacher@demo.local',
    name: 'Иван Учитель',
    firstName: 'Иван',
    lastName: 'Учитель',
    passwordEnv: 'DEMO_TEACHER_PASSWORD',
  },
}

export const DEMO_EMAILS = DEMO_ROLES.map((role) => DEMO_USERS[role].email)

/** Дефолтный пароль — демо публичное, «секрет» тут условный. */
const DEMO_DEFAULT_PASSWORD = 'demo1234'

export function demoPassword(role: DemoRole): string {
  return process.env[DEMO_USERS[role].passwordEnv] || DEMO_DEFAULT_PASSWORD
}

export function isDemoRole(value: string | null | undefined): value is DemoRole {
  return value === 'owner' || value === 'manager' || value === 'teacher'
}

/**
 * Признак демо-организации по её `metadata` (строка с JSON `{ demo: true }`).
 * Терпима к null/битому JSON.
 */
export function isDemoOrg(org: { metadata?: string | null } | null | undefined): boolean {
  if (!org?.metadata) return false
  try {
    return (JSON.parse(org.metadata) as { demo?: boolean })?.demo === true
  } catch {
    return false
  }
}
