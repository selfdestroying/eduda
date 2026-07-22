import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/db', '@repo/ui'],
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
