import GroupDetailPage from '@/src/features/groups/components/detail/group-detail-page'

export const metadata = { title: 'Карточка группы' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)

  return <GroupDetailPage groupId={id} />
}
