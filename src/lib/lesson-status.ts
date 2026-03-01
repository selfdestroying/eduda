import { LessonStatus } from '@/prisma/generated/client'
import { cva } from 'class-variance-authority'

export const lessonStatusMap: Record<LessonStatus, string> = {
  ACTIVE: 'Активен',
  CANCELLED: 'Отменен',
}

export const lessonStatusVariants = cva('', {
  variants: {
    status: {
      ACTIVE: 'text-success',
      CANCELLED: 'text-destructive',
    },
  },
  defaultVariants: {
    status: 'ACTIVE',
  },
})
