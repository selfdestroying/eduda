'use client'

import { memberRoleLabels } from '@/src/components/sidebar/nav-user'
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar'
import { Card, CardContent } from '@/src/components/ui/card'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useSessionQuery } from '@/src/features/users/me/queries'
import type { OrganizationRole } from '@/src/lib/auth/server'
import { Building2, Mail, Shield } from 'lucide-react'

export default function ProfileInfo() {
  const { data: session, isLoading } = useSessionQuery()

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (!session) return null

  const memberRole = session.memberRole as OrganizationRole | undefined
  const orgName = session.organization?.name

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <Avatar className="h-20 w-20">
          <AvatarImage
            src={session.user.image || undefined}
            alt={session.user.name}
            className="object-cover"
          />
          <AvatarFallback className="text-2xl">{session.user.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-2 text-center sm:text-left">
          <div>
            <h2 className="text-xl font-semibold">{session.user.name}</h2>
            <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm sm:justify-start">
              <Mail className="h-3.5 w-3.5" />
              {session.user.email}
            </p>
          </div>
          <div className="text-muted-foreground flex flex-col gap-1 text-sm sm:flex-row sm:gap-4">
            {memberRole && (
              <span className="flex items-center justify-center gap-1.5 sm:justify-start">
                <Shield className="h-3.5 w-3.5" />
                {memberRoleLabels[memberRole]}
              </span>
            )}
            {orgName && (
              <span className="flex items-center justify-center gap-1.5 sm:justify-start">
                <Building2 className="h-3.5 w-3.5" />
                {orgName}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
