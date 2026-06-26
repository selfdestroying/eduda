import ParentCabinetClient from '@/src/features/public-edit/components/parent-cabinet-client'
import { TokenSchema } from '@/src/features/public-edit/schemas'
import prisma from '@/src/lib/db/prisma'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Личный кабинет' }

type PageProps = {
  params: Promise<{ token: string }>
}

export default async function Page({ params }: PageProps) {
  const { token: rawToken } = await params
  const token = TokenSchema.safeParse(rawToken)

  if (!token.success) {
    return notFound()
  }

  // Токен принадлежит родителю (Parent.accessToken).
  const parent = await prisma.parent.findUnique({
    where: { accessToken: token.data },
    select: { id: true },
  })

  if (!parent) {
    return notFound()
  }

  return <ParentCabinetClient token={token.data} />
}
