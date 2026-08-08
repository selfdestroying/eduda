import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@repo/ui/components/empty'

/**
 * Пустое состояние разделов кабинета: «детей не привязано», ошибка загрузки,
 * пустой список. Один компонент вместо восьми одинаковых блоков по разделам.
 */
export function CabinetEmpty({ title, description }: { title: string; description?: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  )
}

/** Родителю не привязали ни одного ученика — показываем во всех разделах. */
export function NoChildren() {
  return (
    <CabinetEmpty
      title="Детей пока нет"
      description="К вашему профилю не привязано ни одного ученика. Обратитесь к администратору школы."
    />
  )
}
