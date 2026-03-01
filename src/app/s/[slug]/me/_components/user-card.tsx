'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent } from '@/src/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { useSessionQuery } from '@/src/data/user/session-query'
import { useSessionRevokeMutation } from '@/src/data/user/session-revoke-mutation'
import type { Session } from '@/src/lib/auth/server'
import { Laptop, Loader2, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { UAParser } from 'ua-parser-js'
import { ChangePasswordForm } from './change-password-form'

const UserCard = (props: { session: Session | null; activeSessions: Session['session'][] }) => {
  const router = useRouter()
  const revokeSessionMutation = useSessionRevokeMutation()
  const { data } = useSessionQuery()
  const session = data || props.session
  const [activeSessions, setActiveSessions] = useState(props.activeSessions)
  const removeActiveSession = (id: string) =>
    setActiveSessions(activeSessions.filter((session) => session.id !== id))

  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="hidden h-9 w-9 sm:flex">
                <AvatarImage
                  src={session?.user.image || undefined}
                  alt="Avatar"
                  className="object-cover"
                />
                <AvatarFallback>{session?.user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="grid">
                <div className="flex items-center gap-1">
                  <p className="text-sm leading-none font-medium">{session?.user.name}</p>
                </div>
                <p className="text-sm">{session?.user.email}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-max flex-col gap-1 border-l-2 px-2">
          <p className="text-xs font-medium">Активные сессии</p>
          {activeSessions
            .filter((session) => session.userAgent)
            .map((session) => {
              const isCurrentSession = session.id === props.session?.session.id
              const isTerminating =
                revokeSessionMutation.isPending &&
                revokeSessionMutation.variables?.token === session.token

              return (
                <div key={session.id}>
                  <div className="flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                    {new UAParser(session.userAgent || '').getDevice().type === 'mobile' ? (
                      <Smartphone />
                    ) : (
                      <Laptop size={16} />
                    )}
                    {new UAParser(session.userAgent || '').getOS().name || session.userAgent},{' '}
                    {new UAParser(session.userAgent || '').getBrowser().name}
                    <Button
                      variant={'destructive'}
                      onClick={() => {
                        revokeSessionMutation.mutate(
                          { token: session.token },
                          {
                            onSuccess: () => {
                              removeActiveSession(session.id)
                              if (isCurrentSession) {
                                router.push('/')
                              }
                            },
                          },
                        )
                      }}
                    >
                      {isTerminating ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : isCurrentSession ? (
                        'Выйти'
                      ) : (
                        'Завершить'
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
        </div>
        <div>
          <ChangePassword />
        </div>
      </CardContent>
    </Card>
  )
}
export default UserCard

function ChangePassword() {
  const [open, setOpen] = useState<boolean>(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={'outline'} />}>Сменить пароль</DialogTrigger>
      <DialogContent className="w-11/12 sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Сменить пароль</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <ChangePasswordForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
