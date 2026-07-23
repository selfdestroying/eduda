import { StudentNav } from '@/src/components/student-nav'
import { getStudentSession, ORG_UNAVAILABLE } from '@/src/lib/auth/student-session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  // Сюда не попасть без better-auth-сессии (гейт 1 в proxy), поэтому пустой
  // резолв означает ровно одно: школа ученика недоступна. Сообщаем об этом на
  // форме входа, иначе ученик с верным паролем молча улетал бы на неё по кругу.
  const session = await getStudentSession(await headers())
  if (!session) redirect(`/login?error=${ORG_UNAVAILABLE}`)

  return (
    <div className="min-h-svh">
      <StudentNav shopDisabled={session.disabledShop} />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  )
}
