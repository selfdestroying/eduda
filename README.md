ЕДУДА — a multi-tenant SaaS dashboard for educational centers. **pnpm + Turborepo monorepo**: the dashboard lives in `apps/platform`, the public documentation in `apps/docs` (fumadocs), Prisma in `packages/db` (`@repo/db`), the shared design system in `packages/ui` (`@repo/ui`).

## Getting Started

Requires Node (see `.nvmrc`) and pnpm (`corepack enable pnpm`). From the repo root:

```bash
pnpm install     # installs all packages, generates the Prisma client
pnpm dev         # starts both dev servers
```

The dashboard is on [http://localhost:3000](http://localhost:3000), the documentation on [http://localhost:3001](http://localhost:3001). The dashboard uses subdomains for tenants (`slug.localhost:3000`) — see `apps/platform/.env.example` and `apps/docs/.env.example`.

The dev servers auto-update as you edit files under `apps/platform/src/` and `apps/docs/`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
