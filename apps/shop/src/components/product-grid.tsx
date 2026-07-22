import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@repo/ui/components/empty'
import { CatalogProduct, ProductCard } from './product-card'

export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  if (products.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Товаров нет</EmptyTitle>
          <EmptyDescription>Школа ещё не добавила товары в эту категорию.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
