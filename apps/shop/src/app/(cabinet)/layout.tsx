import { StudentNav, StudentTabBar } from '@/src/components/student-nav'
import { getStudentSession, loginRedirect } from '@/src/lib/auth/student-session'
import { isSeptember } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  // Живая сессия без `StudentAccount` означает недоступную школу — об этом надо
  // сказать, иначе ученик с верным паролем молча улетал бы на форму по кругу.
  // Истёкшая сессия — обычное «войдите», без пугающего текста.
  const reqHeaders = await headers()
  const session = await getStudentSession(reqHeaders)
  if (!session) redirect(await loginRedirect(reqHeaders))

  return (
    <div className="min-h-svh">
      <StudentNav
        shopDisabled={session.disabledShop}
        name={session.profile.name}
        coins={session.profile.coins}
        september={isSeptember(session.org.timezone)}
      />
      {/* pb-20 — под фиксированный таб-бар, его на десктопе нет. */}
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-20 md:pb-6">{children}</main>
      <StudentTabBar shopDisabled={session.disabledShop} />
    </div>
  )
}
