'use client'

import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { Input } from '@/src/components/ui/input'
import { authClient } from '@/src/lib/auth/client'
import { Check, Dices, KeyRound, Loader } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { AdminUser } from './types'

interface PasswordChangeDialogProps {
  user: AdminUser
  disabled?: boolean
}

export default function PasswordChangeDialog({ user, disabled }: PasswordChangeDialogProps) {
  const [password, setPassword] = useState('')
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)

  const generatePassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    setPassword(result)
  }

  const handleSubmit = () => {
    if (!password || password.length < 8) {
      toast.error('Пароль должен быть не менее 8 символов')
      return
    }
    startTransition(async () => {
      try {
        await authClient.admin.setUserPassword({ userId: user.id, newPassword: password })
        toast.success('Пароль обновлён')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка')
      }
      setPassword('')
      setDialogOpen(false)
    })
  }

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setPassword('')
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button size="icon" variant="ghost" title="Сменить пароль" disabled={disabled} />}
      >
        <KeyRound className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Сменить пароль</DialogTitle>
          <DialogDescription>
            Новый пароль для {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="Новый пароль (мин. 8 символов)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Сгенерировать пароль"
            onClick={generatePassword}
          >
            <Dices className="size-4" />
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} size="icon">
            {isPending ? <Loader className="animate-spin" /> : <Check />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
