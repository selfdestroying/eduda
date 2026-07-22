import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui'],
  allowedDevOrigins: [
    process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(':')[0] || '',
    `*.${process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(':')[0] || ''}`,
  ],
}

const withMDX = createMDX({
  // customize the config file path
  // configPath: "source.config.ts"
})

export default withMDX(nextConfig)
