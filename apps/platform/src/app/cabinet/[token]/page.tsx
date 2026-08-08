import CabinetHome from '@/src/features/public-edit/components/cabinet-home'

// Токен проверил layout сегмента, а каждый action всё равно перепроверяет его
// сам — страницам остаётся только передать его вниз.
type PageProps = {
  params: Promise<{ token: string }>
}

export default async function Page({ params }: PageProps) {
  const { token } = await params
  return <CabinetHome token={token} />
}
