import { StudentNav } from '@/src/components/student-nav'

export default function CabinetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh">
      <StudentNav />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  )
}
