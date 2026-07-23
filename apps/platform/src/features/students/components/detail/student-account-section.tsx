'use client'

import { StudentAccount } from '@repo/db'
import { Button } from '@repo/ui/components/button'
import { StatCard } from '@repo/ui/components/stat-card'
import { Eye, EyeOff, KeyRound, Loader2, Lock, User } from 'lucide-react'
import { useRevealStudentPasswordMutation } from '../../queries'

interface StudentAccountSectionProps {
  account: StudentAccount | null
}

export default function StudentAccountSection({ account }: StudentAccountSectionProps) {
  const reveal = useRevealStudentPasswordMutation()

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

  // Пароль в БД зашифрован, а не лежит открытым текстом, поэтому его не может
  // отрисовать сервер — только запрос по кнопке (и он же пишется в аудит).
  const password = reveal.data

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <Lock size={20} />
        Учётная запись
      </h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Логин" value={account.login} icon={User} />
        <StatCard
          label="Пароль"
          icon={KeyRound}
          value={
            password ? (
              // Пароль убирается с экрана той же кнопкой: он остаётся видимым,
              // пока карточка открыта, а её могут не закрыть и уйти.
              <span className="flex items-center gap-2">
                {password}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  title="Скрыть пароль"
                  onClick={() => reveal.reset()}
                >
                  <EyeOff />
                </Button>
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 h-7 px-2"
                disabled={reveal.isPending}
                onClick={() => reveal.mutate({ studentId: account.studentId })}
              >
                {reveal.isPending ? <Loader2 className="animate-spin" /> : <Eye />}
                Показать
              </Button>
            )
          }
        />
      </div>
    </div>
  )
}
