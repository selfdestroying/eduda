'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { ChangePasswordForm } from './change-password-form'

export default function ChangePasswordCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Сменить пароль</CardTitle>
        <CardDescription>Используйте надёжный пароль длиной не менее 8 символов</CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm />
      </CardContent>
    </Card>
  )
}
