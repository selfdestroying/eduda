import CreateGroupForm from '@/src/features/groups/components/create-group-form'

export const metadata = { title: 'Создать группу' }

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <CreateGroupForm />
    </div>
  )
}
