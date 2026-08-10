export interface StudentAdvanceRow {
  id: number
  name: string
  /** Сумма всех оплат студента до конца периода */
  totalPaid: number
  /** Общее кол-во оплаченных занятий */
  totalLessonsPaid: number
  /** Средняя стоимость одного занятия */
  avgCostPerLesson: number
  /** Кол-во списанных занятий до начала периода */
  chargedBeforeCount: number
  /** Выручка до начала периода */
  revenueBefore: number
  /** Аванс на начало периода */
  advanceAtStart: number
  /** Кол-во списанных занятий в периоде */
  chargedInPeriodCount: number
  /** Выручка за период */
  revenueInPeriod: number
  /** Аванс на конец периода */
  advanceAtEnd: number
  /** Всего посещений в периоде */
  totalAttendancesInPeriod: number
  /** Оплачено до начала периода */
  paidBefore: number
  /** Оплачено внутри периода */
  paidInPeriod: number
  /** Занятий проведено, а оплаты под них нет. Цены у них ещё не существует. */
  unpaidCount: number
}

export interface AdvanceTotals {
  totalPaid: number
  advanceAtStart: number
  /** Оплачено до начала периода */
  paidBefore: number
  /** Выручка до начала периода */
  revenueBefore: number
  paidInPeriod: number
  revenueInPeriod: number
  advanceAtEnd: number
  chargedInPeriod: number
  totalAttendances: number
  /** Количество активных студентов (с оплатами/посещениями/авансом) */
  activeStudents: number
  /** Количество студентов, у которых есть занятия без оплаты */
  negativeBalanceStudents: number
  /** Средняя стоимость за списанное посещение */
  avgCostPerVisit: number
  /** Процент списания (chargedInPeriod / totalAttendances) */
  chargeRate: number
}

export interface AdvancesData {
  students: StudentAdvanceRow[]
  totals: AdvanceTotals
  periodLabel: string
}
