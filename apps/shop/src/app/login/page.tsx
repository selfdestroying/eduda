import { LoginForm } from '@/src/features/auth/components/login-form'
import { getStudentSession } from '@/src/lib/auth/student-session'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Logo } from '@repo/ui/components/logo'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Вход' }

export default async function LoginPage() {
  // Тот же резолв, что и у `studentAction`: если школа ученика недоступна,
  // сессия здесь тоже «не считается» и цикла редиректов не возникает.
  const session = await getStudentSession(await headers())
  if (session) {
    redirect('/')
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo className="text-primary mx-auto size-10" />
          <CardTitle>Кабинет ученика</CardTitle>
          <CardDescription>Логин и пароль выдаёт школа</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
