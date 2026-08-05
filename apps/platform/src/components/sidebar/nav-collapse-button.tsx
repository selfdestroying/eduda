'use client'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@repo/ui/components/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/tooltip'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Kbd, KbdGroup } from '@repo/ui/components/kbd'

/**
 * Compact icon-only sidebar collapse toggle for desktop.
 * Hidden on mobile (sheet mode handles its own close button).
 */
export default function NavCollapseButton() {
  const { state, toggleSidebar, isMobile } = useSidebar()

  if (isMobile) return null

  const isExpanded = state === 'expanded'
  const Icon = isExpanded ? PanelLeftClose : PanelLeftOpen

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger render={<SidebarMenuButton onClick={toggleSidebar} />}>
            <Icon />
            <span>Свернуть</span>
          </TooltipTrigger>
          <TooltipContent side="right">
            <KbdGroup>
              <Kbd>⌘ B</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
