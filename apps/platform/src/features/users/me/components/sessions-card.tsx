'use client'

import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useSessionQuery } from '@/src/features/users/me/queries'
import { useSessionRevokeMutation } from '@/src/features/users/me/queries'
import { Laptop, Loader, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { UAParser } from 'ua-parser-js'
import { useActiveSessionsQuery } from '../queries'

export default function SessionsCard() {
  const router = useRouter()
  const revokeSessionMutation = useSessionRevokeMutation()
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const { data: activeSessions = [], isLoading: isSessionsLoading } = useActiveSessionsQuery()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Активные сессии</CardTitle>
        <CardDescription>Устройства, на которых вы вошли в свой аккаунт</CardDescription>
      </CardHeader>
      <CardContent>
        {isSessionLoading || isSessionsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="flex flex-col gap-2">
            {activeSessions
              .filter((s) => s.userAgent)
              .map((s) => {
                const isCurrentSession = s.id === session?.session.id
                const isTerminating =
                  revokeSessionMutation.isPending &&
                  revokeSessionMutation.variables?.token === s.token
                const ua = new UAParser(s.userAgent || '')
                const isMobile = ua.getDevice().type === 'mobile'

                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {isMobile ? <Smartphone size={16} /> : <Laptop size={16} />}
                      <span>
                        {ua.getOS().name || s.userAgent}, {ua.getBrowser().name}
                        {isCurrentSession && (
                          <span className="text-muted-foreground ml-2 text-xs">(текущая)</span>
                        )}
                      </span>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isTerminating}
                      onClick={() => {
                        revokeSessionMutation.mutate(
                          { token: s.token },
                          {
                            onSuccess: () => {
                              if (isCurrentSession) {
                                router.push('/')
                              }
                            },
                          },
                        )
                      }}
                    >
                      {isTerminating ? (
                        <Loader size={15} className="animate-spin" />
                      ) : isCurrentSession ? (
                        'Выйти'
                      ) : (
                        'Завершить'
                      )}
                    </Button>
                  </div>
                )
              })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
