import { redirect } from 'next/navigation'
import { protocol, rootDomain } from '../lib/utils'

// Гейт корневого `/` реализован в proxy.ts (проверка сессии + редирект в школу
// или на вход). Сюда запрос в норме не доходит — это защитный фолбэк на случай
// обхода proxy.
export default function HomePage() {
  redirect(`${protocol}://auth.${rootDomain}`)
}
