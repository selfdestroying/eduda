import { PayCheckType } from '@/prisma/generated/client'

export const payCheckTypeLabels: Record<PayCheckType, string> = {
  SALARY: 'Зарплата',
  BONUS: 'Бонус',
  ADVANCE: 'Аванс',
}

export const payCheckTypeOptions: Array<{ value: PayCheckType; label: string }> = [
  { value: 'SALARY', label: payCheckTypeLabels.SALARY },
  { value: 'BONUS', label: payCheckTypeLabels.BONUS },
  { value: 'ADVANCE', label: payCheckTypeLabels.ADVANCE },
]
