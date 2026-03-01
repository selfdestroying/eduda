'use client'

import DataTable from '@/src/components/data-table'
import { Badge } from '@/src/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Input } from '@/src/components/ui/input'
import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import CreateOrganizationDialog from './create-organization-dialog'
import type { AdminDashboardData, AdminOrganization } from './types'

interface OrganizationsTableProps {
  data: AdminDashboardData
  onRefresh: () => void
}

export default function OrganizationsTable({ data }: OrganizationsTableProps) {
  const [search, setSearch] = useState('')

  const filteredOrganizations = useMemo(() => {
    if (!search.trim()) return data.organizations
    const q = search.toLowerCase()
    return data.organizations.filter(
      (o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q),
    )
  }, [data.organizations, search])

  const getMemberRoleCounts = (members: AdminDashboardData['organizations'][number]['members']) => {
    const counts: Record<string, number> = {}
    members.forEach((m) => {
      counts[m.role] = (counts[m.role] || 0) + 1
    })
    return counts
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Организации ({data.organizations.length})</span>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Поиск по названию, slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <CreateOrganizationDialog />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredOrganizations.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Организации не найдены</p>
          ) : (
            filteredOrganizations.map((org) => {
              const roleCounts = getMemberRoleCounts(org.members)
              return (
                <Card key={org.id} className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          {org.name}
                          <Badge variant="secondary" className="text-xs font-normal">
                            {org.slug}
                          </Badge>
                        </CardTitle>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Создана: {format(new Date(org.createdAt), 'dd MMM yyyy', { locale: ru })}
                          {' · '}
                          ID: {org.id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <Users className="size-3" />
                          {org.members.length}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Роли */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      {Object.entries(roleCounts).map(([role, count]) => (
                        <Badge key={role} variant="outline" className="text-xs">
                          {role}: {count}
                        </Badge>
                      ))}
                    </div>

                    {/* Участники */}
                    {org.members.length > 0 && <OrgMembersDataTable members={org.members} />}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

type OrgMember = AdminOrganization['members'][number]

const orgMemberColumns: ColumnDef<OrgMember>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
  {
    id: 'userName',
    header: 'Пользователь',
    cell: ({ row }) => <span className="font-medium">{row.original.user.name}</span>,
  },
  {
    id: 'userEmail',
    header: 'Email',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">{row.original.user.email}</span>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Роль в организации',
    cell: ({ row }) => (
      <Badge variant={row.original.role === 'owner' ? 'default' : 'secondary'}>
        {row.original.role}
      </Badge>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Дата вступления',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {format(new Date(row.original.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
      </span>
    ),
  },
]

function OrgMembersDataTable({ members }: { members: OrgMember[] }) {
  const table = useReactTable({
    data: members,
    columns: orgMemberColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} />
}
