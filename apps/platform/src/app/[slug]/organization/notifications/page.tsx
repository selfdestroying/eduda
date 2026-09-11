import MaxBotSettings from '@/src/features/notifications/components/max-bot-settings'
import ReminderSettings from '@/src/features/notifications/components/reminder-settings'
import RemindersOverview from '@/src/features/notifications/components/reminders-overview'

export const metadata = { title: 'Боты' }

export default function Page() {
  return (
    <div className="space-y-2">
      <MaxBotSettings />
      <ReminderSettings />
      <RemindersOverview />
    </div>
  )
}
