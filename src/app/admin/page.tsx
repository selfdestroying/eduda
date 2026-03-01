import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminDashboard from './_components/admin-dashboard'

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }

  const [organizations, users] = await Promise.all([
    prisma.organization.findMany({
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        banned: true,
        createdAt: true,
        emailVerified: true,
      },
    }),
  ])

  return <AdminDashboard initialData={{ organizations, users }} />
}
