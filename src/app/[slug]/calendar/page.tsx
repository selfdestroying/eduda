import { Calendar } from '@/src/features/calendar/components/calendar'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Календарь' }

export default function Page() {
  return <Calendar />
}
