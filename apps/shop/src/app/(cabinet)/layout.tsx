import { StudentNav } from '@/src/components/student-nav'
import { getStudentSession } from '@/src/lib/auth/student-session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const session = await getStudentSession(await headers())
  if (!session) redirect('/login')

  return (
    <div className="min-h-svh">
      <StudentNav shopDisabled={session.disabledShop} />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  )
}
