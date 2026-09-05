import ReminderSettings from '@/src/features/notifications/components/reminder-settings'
import RemindersOverview from '@/src/features/notifications/components/reminders-overview'

export const metadata = { title: 'Боты' }

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <ReminderSettings />
      <RemindersOverview />
    </div>
  )
}
