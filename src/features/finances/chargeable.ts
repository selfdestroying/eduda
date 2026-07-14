import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schema & type
// ---------------------------------------------------------------------------

export const ChargeableStatus = z.enum([
  'present',
  'absent_no_warn',
  'absent_warned',
  'makeup_success',
  'makeup_fail',
])
export type ChargeableStatus = z.infer<typeof ChargeableStatus>

// ---------------------------------------------------------------------------
// UI options (for filter checkboxes)
// ---------------------------------------------------------------------------

export const CHARGEABLE_STATUS_OPTIONS: {
  value: ChargeableStatus
  label: string
  depth: number
}[] = [
  { value: 'present', label: 'Посетил', depth: 0 },
  { value: 'absent_no_warn', label: 'Не предупредил', depth: 0 },
  { value: 'absent_warned', label: 'Предупредил, без отработки', depth: 0 },
  { value: 'makeup_success', label: 'Предупредил, отработка засчитана', depth: 1 },
  { value: 'makeup_fail', label: 'Предупредил, отработка не засчитана', depth: 1 },
]

export const DEFAULT_CHARGEABLE_STATUSES: ChargeableStatus[] = [
  'present',
  'absent_no_warn',
  'makeup_success',
]

// ---------------------------------------------------------------------------
// Labels (for server-side cost reasons)
// ---------------------------------------------------------------------------

export const CLASSIFICATION_LABELS: Record<ChargeableStatus, string> = {
  present: 'Присутствовал',
  absent_no_warn: 'Не предупредил',
  absent_warned: 'Предупредил, без отработки',
  makeup_success: 'Предупредил, отработка засчитана',
  makeup_fail: 'Предупредил, отработка не засчитана',
}

// ---------------------------------------------------------------------------
// Classification & charge check
// ---------------------------------------------------------------------------

export type AttendanceClassifiable = {
  status: string
  isWarned: boolean | null
  makeupAttendance?: { status: string } | null
}

export function classifyAttendance(att: AttendanceClassifiable): ChargeableStatus | null {
  if (att.status === 'PRESENT') return 'present'
  if (att.status === 'ABSENT' && !att.isWarned) return 'absent_no_warn'
  if (att.status === 'ABSENT' && att.isWarned) {
    if (att.makeupAttendance) {
      if (att.makeupAttendance.status === 'PRESENT') return 'makeup_success'
      if (att.makeupAttendance.status !== 'PRESENT') return 'makeup_fail'
    }
    return 'absent_warned'
  }
  return null
}

export function isChargeable(att: AttendanceClassifiable, statuses: ChargeableStatus[]): boolean {
  const classification = classifyAttendance(att)
  return classification !== null && statuses.includes(classification)
}

// ---------------------------------------------------------------------------
// Shared types for revenue computation
// ---------------------------------------------------------------------------

export interface StudentRevenueEntry {
  studentId: number
  visitCost: number
  /** Дата урока `YYYY-MM-DD`. */
  lessonDate: string
}

/**
 * Aggregates visit costs by student from computeAttendanceRevenue results.
 * Returns Map<studentId, totalRevenue>.
 */
export function aggregateRevenueByStudent(entries: StudentRevenueEntry[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const e of entries) {
    map.set(e.studentId, (map.get(e.studentId) ?? 0) + e.visitCost)
  }
  return map
}
