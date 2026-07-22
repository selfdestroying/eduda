'use client'

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@repo/ui/components/sidebar'
import { docsUrl } from '@/src/lib/utils'
import { BookOpen } from 'lucide-react'

/** Ссылка на пользовательскую документацию (отдельное приложение `apps/docs`). */
export default function NavDocs() {
  const href = `${docsUrl}/user`

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton render={<a href={href} target="_blank" rel="noopener noreferrer" />}>
          <BookOpen />
          <span>Документация</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
