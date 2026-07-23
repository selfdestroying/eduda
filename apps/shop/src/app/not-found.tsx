import CabinetNotFound from './(cabinet)/not-found'

/**
 * Корневой 404 — для адресов вне кабинета (там своя навигация и своя обёртка).
 * Текст один и тот же, поэтому переиспользуем компонент, добавив центрирование:
 * этот рендерится в голом root-layout, без `<main>` кабинета.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md items-center justify-center px-4">
      <CabinetNotFound />
    </div>
  )
}
