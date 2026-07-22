export interface TaxBreakdown {
  taxSystem: string
  taxSystemLabel: string
  incomeTax: number
  incomeTaxRate: number
  insuranceContributions: number
  fixedContributions: number
}

export interface AcquiringBreakdownItem {
  methodName: string
  commissionPercent: number
  paymentSum: number
  fee: number
}

export interface AcquiringData {
  total: number
  breakdown: AcquiringBreakdownItem[]
}

export interface SalaryData {
  total: number
  totalFromLessons: number
  totalFromPaychecks: number
  totalFromManagerFixed: number
  totalFromManagerPaychecks: number
  teacherCount: number
  managerCount: number
  lessonCount: number
}

export interface RentData {
  total: number
  breakdown: RentBreakdownItem[]
}

export interface RentBreakdownItem {
  locationName: string
  amount: number
}

export interface ExpenseData {
  total: number
  breakdown: ExpenseBreakdownItem[]
}

export interface ExpenseBreakdownItem {
  name: string
  amount: number
}

export interface ProfitData {
  revenue: number
  taxes: {
    total: number
    breakdown: TaxBreakdown
  }
  acquiring: AcquiringData
  salaries: SalaryData
  rent: RentData
  expenses: ExpenseData
  profit: number
}

export interface ProfitMonthEntry {
  /** 0-based index in calendar year (0 = January) */
  monthIndex: number
  /** Short Russian label, e.g. "янв" */
  label: string
  /** ISO date of month start (YYYY-MM-01) */
  startDate: string
  /** ISO date of month end (last day, end of day) */
  endDate: string
  revenue: number
  taxes: number
  acquiring: number
  salaries: number
  rent: number
  expenses: number
  profit: number
  /** Detailed per-category breakdowns for expanded row view */
  breakdowns: {
    taxes: TaxBreakdown
    acquiring: AcquiringBreakdownItem[]
    salaries: SalaryData
    rent: RentBreakdownItem[]
    expenses: ExpenseBreakdownItem[]
  }
}

export interface ProfitMonthlyTotals {
  revenue: number
  taxes: number
  acquiring: number
  salaries: number
  rent: number
  expenses: number
  profit: number
}

export interface ProfitMonthlyData {
  year: number
  taxSystemLabel: string
  months: ProfitMonthEntry[]
  totals: ProfitMonthlyTotals
}
