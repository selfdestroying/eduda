import { getAttendance } from '@/src/features/attendance/actions'
import { AttendanceTable } from '@/src/features/attendance/components/attendance-table'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Посещаемость' }

const LIMIT = 100

export default async function AttendancePage() {
  const { data, serverError } = await getAttendance({ limit: LIMIT })

  if (serverError || !data) {
    throw new Error(serverError || 'Не удалось загрузить посещаемость')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Посещаемость</h1>
      <AttendanceTable rows={data} limit={LIMIT} />
    </div>
  )
}
