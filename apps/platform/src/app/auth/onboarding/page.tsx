import type { Metadata } from 'next'
import Onboarding from './_components/onboarding'

export const metadata: Metadata = {
  title: 'Настройка школы — ЕДУДА',
}

export default function Page() {
  return <Onboarding />
}
