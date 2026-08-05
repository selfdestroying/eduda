import { CatalogProduct } from '@/src/components/product-card'
import { ProductGrid } from '@/src/components/product-grid'
import { cn } from '@/src/lib/utils'
import Link from 'next/link'

interface CatalogViewProps {
  products: CatalogProduct[]
  categories: { id: number; name: string }[]
  activeCategoryId: number | null
}

/**
 * Фильтр категории — обычные ссылки на `?category=`, а не клиентское состояние:
 * страница и так `force-dynamic`, поэтому переход по ссылке перерисовывает её
 * ровно так же, но без единого килобайта JS.
 */
export function CatalogView({ products, categories, activeCategoryId }: CatalogViewProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Магазин</h1>

      {categories.length > 0 && (
        <nav className="flex flex-wrap gap-2">
          <CategoryLink href="/shop" active={activeCategoryId === null}>
            Все
          </CategoryLink>
          {categories.map((category) => (
            <CategoryLink
              key={category.id}
              href={`/shop?category=${category.id}`}
              active={activeCategoryId === category.id}
            >
              {category.name}
            </CategoryLink>
          ))}
        </nav>
      )}

      <ProductGrid products={products} />
    </div>
  )
}

function CategoryLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'bg-primary text-primary-foreground border-transparent'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
