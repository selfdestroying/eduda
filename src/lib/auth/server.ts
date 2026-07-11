import { prismaAdapter } from '@better-auth/prisma-adapter'
import { APIError, betterAuth, type BetterAuthOptions } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { admin as adminPlugin, customSession, organization } from 'better-auth/plugins'
import prisma from '../db/prisma'
import { getEffectiveFeatures } from '../features/effective'
import globalPermissions from '../permissions/global'
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
          const member = await prisma.member.findFirst({
            where: { userId: Number(session.userId) },
            include: { organization: true },
          })

          if (!member) {
            throw new APIError('UNAUTHORIZED', {
              message: 'Вы не состоите ни в одной школе.',
            })
          }

          return {
            data: {
              ...session,
              activeOrganizationId: member.organizationId.toString(),
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
    adminPlugin({ ...globalPermissions }),
    organization({
      ...organizationPermissions,
      dynamicAccessControl: {
        enabled: true,
      },
      allowUserToCreateOrganization: true,
      schema: {
        member: { modelName: 'Member' },
        organization: { modelName: 'Organization' },
        invitation: { modelName: 'Invitation' },
        role: { modelName: 'OrganizationRole' },
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

      const { disabledFeatures } = await getEffectiveFeatures(member?.organizationId ?? null)

      return {
        user,
        session,
        organization: member?.organization ?? null,
        organizationId: member?.organizationId ?? null,
        memberRole: member?.role ?? null,
        userRole: user.role,
        disabledFeatures,
      }
    }, options),
    nextCookies(), // должен быть последним плагином
  ],
})

export type Session = typeof auth.$Infer.Session
export type OrganizationRole = 'owner' | 'manager' | 'teacher'
