export const ALERT_TYPE = {
  UNMARKED_ATTENDANCE: 'UNMARKED_ATTENDANCE',
  LOW_BALANCE: 'LOW_BALANCE',
  NEGATIVE_BALANCE: 'NEGATIVE_BALANCE',
  CONSECUTIVE_ABSENCES: 'CONSECUTIVE_ABSENCES',
} as const

export type AlertType = (typeof ALERT_TYPE)[keyof typeof ALERT_TYPE]

export const ALERT_TYPE_VALUES = Object.values(ALERT_TYPE) as AlertType[]

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  [ALERT_TYPE.UNMARKED_ATTENDANCE]: 'Посещаемость',
  [ALERT_TYPE.NEGATIVE_BALANCE]: 'Долги',
  [ALERT_TYPE.LOW_BALANCE]: 'Заканчивается баланс',
  [ALERT_TYPE.CONSECUTIVE_ABSENCES]: 'Зона риска',
}

export const ALERT_TYPE_ORDER: Record<AlertType, number> = {
  [ALERT_TYPE.UNMARKED_ATTENDANCE]: 0,
  [ALERT_TYPE.NEGATIVE_BALANCE]: 1,
  [ALERT_TYPE.LOW_BALANCE]: 2,
  [ALERT_TYPE.CONSECUTIVE_ABSENCES]: 3,
}

export type AlertSeverity = 'red' | 'orange' | 'yellow'

export const ALERT_SEVERITY_VALUES = ['red', 'orange', 'yellow'] as const

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  red: 'Критично',
  orange: 'Риск',
  yellow: 'Предупреждение',
}

export const ALERT_SEVERITY_ORDER: Record<AlertSeverity, number> = {
  red: 0,
  orange: 1,
  yellow: 2,
}

export const SMART_FEED_STATUS = {
  ACTIVE: 'active',
  SNOOZED: 'snoozed',
} as const

export type SmartFeedStatus = (typeof SMART_FEED_STATUS)[keyof typeof SMART_FEED_STATUS]

export const SMART_FEED_TAB_VALUES = [SMART_FEED_STATUS.ACTIVE, SMART_FEED_STATUS.SNOOZED] as const

export type SmartFeedTab = (typeof SMART_FEED_TAB_VALUES)[number]

export interface UnmarkedAttendanceAlert {
  type: typeof ALERT_TYPE.UNMARKED_ATTENDANCE
  severity: 'red'
  lessonId: number
  lessonDate: string
  lessonTime: string
  groupId: number
  groupName: string
  unspecifiedCount: number
}

export interface LowBalanceAlert {
  type: typeof ALERT_TYPE.LOW_BALANCE
  severity: 'yellow'
  walletId: number
  studentId: number
  studentName: string
  groupId: number
  groupName: string
  lessonsBalance: number
}

export interface NegativeBalanceAlert {
  type: typeof ALERT_TYPE.NEGATIVE_BALANCE
  severity: 'red'
  walletId: number
  studentId: number
  studentName: string
  groupId: number
  groupName: string
  lessonsBalance: number
}

export interface ConsecutiveAbsencesAlert {
  type: typeof ALERT_TYPE.CONSECUTIVE_ABSENCES
  severity: 'orange'
  studentId: number
  studentName: string
  groupId: number
  groupName: string
  absenceCount: number
}

export type SmartFeedAlert =
  | UnmarkedAttendanceAlert
  | LowBalanceAlert
  | NegativeBalanceAlert
  | ConsecutiveAbsencesAlert

export type SnoozableSmartFeedAlert = LowBalanceAlert | NegativeBalanceAlert

export type SmartFeedPageAlert = SmartFeedAlert & {
  id: string
  entityKey: string
  snoozedUntil: Date | null
  status: SmartFeedStatus
}

export interface SmartFeedPageData {
  active: SmartFeedPageAlert[]
  snoozed: SmartFeedPageAlert[]
}

export function getSmartFeedEntityKey(alert: SmartFeedAlert): string {
  switch (alert.type) {
    case ALERT_TYPE.UNMARKED_ATTENDANCE:
      return `lesson:${alert.lessonId}`
    case ALERT_TYPE.LOW_BALANCE:
    case ALERT_TYPE.NEGATIVE_BALANCE:
      return `wallet:${alert.walletId}`
    case ALERT_TYPE.CONSECUTIVE_ABSENCES:
      return `student:${alert.studentId}:group:${alert.groupId}`
  }
}

export function getSmartFeedAlertId(alert: SmartFeedAlert): string {
  return `${alert.type}:${getSmartFeedEntityKey(alert)}`
}
