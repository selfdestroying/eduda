'use client'

import { Button } from '@/src/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function AddGroupButton() {
  return (
    <Button size={'icon'} nativeButton={false} render={<Link href="/groups/create" />}>
      <Plus />
    </Button>
  )
}
