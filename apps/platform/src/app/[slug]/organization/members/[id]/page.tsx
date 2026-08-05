import MemberDetail from '@/src/features/organization/members/components/member-detail'

export const metadata = { title: 'Карточка пользователя' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return <MemberDetail userId={Number(id)} />
}
