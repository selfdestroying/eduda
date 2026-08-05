'use client'

import { Button } from '@repo/ui/components/button'
import { Loader } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { claimAchievement } from '../actions'

/**
 * Единственный клиентский кусок страницы. Без TanStack: query-слой в кабинете
 * есть только у корзины, остальное перерисовывает сервер (`router.refresh()`) —
 * он же обновит баланс в шапке.
 */
export function ClaimButton({ achievementKey, coins }: { achievementKey: string; coins: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const claim = () =>
    startTransition(async () => {
      const { serverError } = await claimAchievement({ key: achievementKey })
      if (serverError) {
        toast.error(serverError)
        // Отказ означает, что данные на экране устарели, — перечитываем.
        router.refresh()
        return
      }
      toast.success(`Получено ${coins} коинов`)
      router.refresh()
    })

  return (
    <Button size="lg" className="w-full" disabled={pending} onClick={claim}>
      {pending ? <Loader className="animate-spin" /> : 'Забрать'}
    </Button>
  )
}
