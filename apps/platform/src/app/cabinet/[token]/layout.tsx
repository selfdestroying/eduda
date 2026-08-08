import { CabinetNav, CabinetTabBar } from '@/src/features/public-edit/components/cabinet-nav'
import { TokenSchema } from '@/src/features/public-edit/schemas'
import { prisma } from '@repo/db'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Личный кабинет' }

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ token: string }>
}

export default async function CabinetLayout({ children, params }: LayoutProps) {
  const { token: rawToken } = await params
  const token = TokenSchema.safeParse(rawToken)

  if (!token.success) {
    return notFound()
  }

  // Токен принадлежит родителю (Parent.accessToken). Гейт стоит в layout, а не
  // в страницах: он один на весь сегмент и не перевыполняется при переходах
  // между разделами.
  const parent = await prisma.parent.findUnique({
    where: { accessToken: token.data },
    select: { id: true },
  })

  if (!parent) {
    return notFound()
  }

  return (
    <div className="min-h-svh">
      <CabinetNav token={token.data} />
      {/* pb-20 — под фиксированный таб-бар, его на десктопе нет. */}
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-20 md:pb-6">{children}</main>
      <CabinetTabBar token={token.data} />
    </div>
  )
}
