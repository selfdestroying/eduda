import { prismaAdapter } from '@better-auth/prisma-adapter'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { admin as adminPlugin, customSession, organization } from 'better-auth/plugins'
import prisma from '../db/prisma'
import permissions from '../permissions/global'
import organizationPermissions from '../permissions/organization'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(':')[0]

const options = {
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  user: {
    modelName: 'User',
  },
  session: {
    modelName: 'Session',
  },
  account: {
    modelName: 'Account',
  },
  verification: {
    modelName: 'Verification',
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  rateLimit: {
    enabled: true,
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const userId = Number(session.userId)
          const member = await prisma.member.findFirst({
            where: { userId },
          })

          return {
            data: {
              ...session,
              activeOrganizationId: member?.organizationId.toString() ?? null,
            },
          }
        },
      },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    crossSubDomainCookies: {
      enabled: true,
      domain: `.${ROOT_DOMAIN}`,
    },
    cookiePrefix: 'dashboard',
    database: {
      generateId: 'serial',
    },
  },
  trustedOrigins: (request) => {
    if (!request) return []
    const origin = request.headers.get('origin')
    if (!origin) return []
    try {
      const url = new URL(origin)
      if (url.hostname.endsWith(`.${ROOT_DOMAIN}`) || url.hostname === ROOT_DOMAIN) {
        return [origin]
      }
    } catch {
      throw new Error('Invalid origin URL')
    }
    return []
  },
  plugins: [
    adminPlugin(permissions),
    organization({
      ...organizationPermissions,
      allowUserToCreateOrganization: true,
      schema: {
        member: { modelName: 'Member' },
        organization: { modelName: 'Organization' },
        invitation: { modelName: 'Invitation' },
      },
    }),
  ],
} satisfies BetterAuthOptions

export const auth = betterAuth({
  ...options,
  plugins: [
    ...(options.plugins ?? []),
    customSession(async ({ user, session }) => {
      const member = await prisma.member.findFirst({
        where: { userId: Number(session.userId) },
        include: { organization: true },
      })

      return {
        user,
        session,
        organization: member?.organization ?? null,
        organizationId: member?.organizationId ?? null,
        memberRole: member?.role ?? null,
        userRole: user.role,
      }
    }, options),
    nextCookies(), // должен быть последним плагином
  ],
})

export type Session = typeof auth.$Infer.Session
export type OrganizationRole = 'owner' | 'manager' | 'teacher'
