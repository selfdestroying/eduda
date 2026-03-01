import { AppSidebar } from '@/src/components/sidebar/app-sidebar'
import { Skeleton } from '@/src/components/ui/skeleton'
import { auth } from '@/src/lib/auth/server'
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { Suspense } from 'react'

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })
  const orgName = session?.organization?.name ?? 'ЕДУДА'

  return {
    title: {
      template: `%s | ${orgName}`,
      default: orgName,
    },
  }
}

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <>
      {/* Decorative background orbs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="animate-landing-float bg-primary/10 absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl" />
        <div className="animate-landing-float-delayed bg-primary/8 absolute -bottom-40 -left-40 h-120 w-120 rounded-full blur-3xl" />
      </div>

      {/* Subtle grid pattern */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[4rem_4rem] opacity-30" />

      <Suspense fallback={<Skeleton className="h-full w-full" />}>
        <AppSidebar defaultOpen={defaultOpen}>{children}</AppSidebar>
      </Suspense>
    </>
  )
}
