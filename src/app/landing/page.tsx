import type { Metadata } from 'next'
import { Landing } from '@/src/components/landing/landing'
import { protocol, rootDomain } from '@/src/lib/utils'

export const metadata: Metadata = {
  title: 'ЕДУДА — CRM для учебного центра: ученики, расписание и финансы в одной системе',
  description:
    'ЕДУДА объединяет учеников, посещаемость, финансы и мотивацию в одной платформе для учебных центров, языковых школ и детских клубов. Меньше рутины — больше прибыли и довольных родителей.',
}

export default function LandingPage() {
  // Публичный лендинг — рендерится статически, без обращения к БД/сессии.
  return <Landing signInUrl={`${protocol}://auth.${rootDomain}`} />
}
