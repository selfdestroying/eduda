import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'

const nextConfig: NextConfig = {
  // На боевом сервере (одно ядро, 2 ГБ) `next build` не помещается в память:
  // проверку типов он гоняет внутри себя, и это как раз тот пик, на котором
  // сборку убивает OOM. На деплое её отключает `SKIP_BUILD_CHECKS=1` — `tsc`
  // к тому моменту уже прошёл в `pnpm check`, повторять его на машине, которая
  // его не тянет, незачем. Локально флага нет, и всё как было.
  typescript: { ignoreBuildErrors: process.env.SKIP_BUILD_CHECKS === '1' },
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
