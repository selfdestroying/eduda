import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // На боевом сервере (одно ядро, 2 ГБ) `next build` не помещается в память:
  // проверку типов он гоняет внутри себя, и это как раз тот пик, на котором
  // сборку убивает OOM. На деплое её отключает `SKIP_BUILD_CHECKS=1` — `tsc`
  // к тому моменту уже прошёл в `pnpm check`, повторять его на машине, которая
  // его не тянет, незачем. Локально флага нет, и всё как было.
  typescript: { ignoreBuildErrors: process.env.SKIP_BUILD_CHECKS === '1' },
  transpilePackages: ['@repo/core', '@repo/db', '@repo/ui'],
  // Кабинет живёт на `shop.{rootDomain}`, а не на localhost, поэтому в dev
  // запросы к /_next иначе считаются кросс-доменными. Так же настроены
  // `apps/platform` и `apps/docs`.
  allowedDevOrigins: [
    process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(':')[0] || '',
    `*.${process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(':')[0] || ''}`,
  ],
  // Картинки товаров пишет платформа, шоп только читает по URL — отсюда копия
  // `images.remotePatterns` из `apps/platform/next.config.ts`. Общего диска нет.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.eduda.online',
        pathname: '/images/**',
      },
      {
        protocol: 'http',
        hostname: 'images.alg.tw1.ru',
      },
    ],
  },
}

export default nextConfig
