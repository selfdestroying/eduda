'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
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
