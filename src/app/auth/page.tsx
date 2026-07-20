import SignIn from './_components/sign-in'

// Гейт по сессии живёт в `proxy` (case 'auth'): он уже держит сессию в руках,
// поэтому проверять её здесь второй раз незачем.
export default function Page() {
  return <SignIn />
}
