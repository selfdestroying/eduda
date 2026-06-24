'use client'

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/src/components/ui/sidebar'
import { protocol, rootDomain } from '@/src/lib/utils'
import { BookOpen } from 'lucide-react'

/** Ссылка на пользовательскую документацию (поддомен docs). */
export default function NavDocs() {
  const href = `${protocol}://docs.${rootDomain}/user`

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
