import { notFound } from 'next/navigation'

// Старый адрес анкеты (ключ на ученика) больше не поддерживается:
// доступ теперь по родительской ссылке /cabinet/[parent.accessToken].
export default function Page() {
  return notFound()
}
