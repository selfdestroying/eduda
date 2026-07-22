'use client'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/src/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Kbd, KbdGroup } from '../ui/kbd'

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
