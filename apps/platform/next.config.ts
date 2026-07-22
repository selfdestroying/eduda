import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'

const nextConfig: NextConfig = {
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

const withMDX = createMDX({
  // customize the config file path
  // configPath: "source.config.ts"
})

export default withMDX(nextConfig)
