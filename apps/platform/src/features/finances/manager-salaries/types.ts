import { Prisma } from '@/prisma/generated/client'

export type ManagerSalaryWithUser = Prisma.ManagerSalaryGetPayload<{
  include: { user: true }
}>

export type ManagerSalaryBreakdown = {
  userId: number
  userName: string
  fixedTotal: number
  bonusTotal: number
  advanceTotal: number
  salaryPayoutsTotal: number
  total: number
}

export type ManagerSalaryData = {
  breakdowns: ManagerSalaryBreakdown[]
  grandTotal: number
}
