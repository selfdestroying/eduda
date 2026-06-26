'use client'

import { Logo } from '@/src/components/logo'
import { Card, CardContent } from '@/src/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { getFullName } from '@/src/lib/utils'
import { useState } from 'react'
import { useCabinetDataQuery } from '../queries'
import FinancesTab from './finances-tab'
import GroupsTab from './groups-tab'
import ProfileTab from './profile-tab'

export type ParentCabinetClientProps = {
  token: string
}

export default function ParentCabinetClient({ token }: ParentCabinetClientProps) {
  const { data, isPending, isError } = useCabinetDataQuery(token)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const children = data?.children ?? []
  const selectedStudentId = selectedId ?? children[0]?.id ?? null

  return (
    <main className="relative flex min-h-screen justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-landing-float bg-primary/10 absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl" />
        <div className="animate-landing-float-delayed bg-primary/8 absolute -bottom-40 -left-40 h-120 w-120 rounded-full blur-3xl" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[4rem_4rem] opacity-30" />

      <div className="relative z-10 flex w-full max-w-2xl flex-col gap-4">
        <header className="flex flex-col items-center gap-3 text-center">
          <div className="ring-border/60 bg-card/80 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl shadow-xl ring-1 shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
            <Logo className="text-primary size-14" />
          </div>
          <div className="space-y-2">
            {isPending ? (
              <Skeleton className="mx-auto h-6 w-48" />
            ) : (
              <>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {data?.organizationName}
                </p>
                <h1 className="text-2xl font-semibold tracking-tight">Личный кабинет</h1>
                {data && (
                  <p className="text-muted-foreground text-sm">
                    {getFullName(data.parent.firstName, data.parent.lastName)}
                  </p>
                )}
                <p className="text-muted-foreground text-center text-xs">
                  Ссылка уникальна для вашего кабинета. Не пересылайте её посторонним.
                </p>
              </>
            )}
          </div>
        </header>

        {isPending ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : isError || !data ? (
          <Card className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Ссылка недействительна или устарела. Запросите новую у администратора.
            </CardContent>
          </Card>
        ) : selectedStudentId == null ? (
          <Card className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              К вашему профилю пока не привязаны дети. Обратитесь к администратору.
            </CardContent>
          </Card>
        ) : (
          <>
            {children.length > 1 && (
              <div className="flex items-center justify-center gap-2">
                <span className="text-muted-foreground text-xs">Ребёнок:</span>
                <Select
                  value={selectedStudentId}
                  onValueChange={(value) => setSelectedId(value as number)}
                >
                  <SelectTrigger className="min-w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {getFullName(child.firstName, child.lastName)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="h-9 w-full">
                <TabsTrigger value="profile">Профиль</TabsTrigger>
                <TabsTrigger value="finances">Финансы</TabsTrigger>
                <TabsTrigger value="groups">Группы и посещаемость</TabsTrigger>
              </TabsList>

              <TabsContent value="profile">
                <ProfileTab token={token} studentId={selectedStudentId} parent={data.parent} />
              </TabsContent>
              <TabsContent value="finances">
                <FinancesTab token={token} studentId={selectedStudentId} />
              </TabsContent>
              <TabsContent value="groups">
                <GroupsTab token={token} studentId={selectedStudentId} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </main>
  )
}
