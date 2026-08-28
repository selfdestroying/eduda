import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // На боевом сервере (одно ядро, 2 ГБ) `next build` не помещается в память:
  // проверку типов он гоняет внутри себя, и это как раз тот пик, на котором
  // сборку убивает OOM. На деплое её отключает `SKIP_BUILD_CHECKS=1` — `tsc`
  // к тому моменту уже прошёл в `pnpm check`, повторять его на машине, которая
  // его не тянет, незачем. Локально флага нет, и всё как было.
  typescript: { ignoreBuildErrors: process.env.SKIP_BUILD_CHECKS === '1' },
  transpilePackages: ['@repo/db', '@repo/ui'],
  allowedDevOrigins: [
    process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(':')[0] || '',
    `*.${process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(':')[0] || ''}`,
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
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
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}

export default nextConfig
