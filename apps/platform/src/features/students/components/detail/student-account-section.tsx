'use client'

import { StudentAccount } from '@/prisma/generated/client'
import { StatCard } from '@/src/components/stat-card'
import { KeyRound, Lock, User } from 'lucide-react'

interface StudentAccountSectionProps {
  account: StudentAccount | null
}

export default function StudentAccountSection({ account }: StudentAccountSectionProps) {
  if (!account) {
    return (
      <div className="space-y-3">
        <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
          <Lock size={20} />
          Учётная запись
        </h3>
        <p className="text-muted-foreground text-sm">Аккаунт ученика не создан</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <Lock size={20} />
        Учётная запись
      </h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Логин" value={account.login} icon={User} />
        <StatCard label="Пароль" value={account.password} icon={KeyRound} />
      </div>
    </div>
  )
}
