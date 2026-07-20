import { prismaAdapter } from '@better-auth/prisma-adapter'
import { APIError, betterAuth, type BetterAuthOptions } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { admin as adminPlugin, customSession, organization } from 'better-auth/plugins'
import prisma from '../db/prisma'
import { getEffectiveFeatures } from '../features/effective'
import globalPermissions from '../permissions/global'
import { extractSubdomain, RESERVED_SLUGS, RESERVED_SUBDOMAINS } from '../utils'
import organizationPermissions, {
  fullPermission,
  getStaticRolePermission,
  systemRoleLabels,
  type OrganizationPermissionCheck,
  type OrganizationRole,
} from '../permissions/organization'

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
  },
  rateLimit: {
    enabled: true,
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // ponytail: «последняя посещённая школа» = просто первая по findFirst.
          // Отдельная колонка `User.lastOrganizationId` понадобится, только когда
          // у людей реально появится несколько школ — при `organizationLimit: 1`
          // вторая возможна лишь по приглашению, так что почти у всех она одна.
          const member = await prisma.member.findFirst({
            where: { userId: Number(session.userId) },
          })

          // Пользователь без школы — легальное состояние сразу после регистрации:
          // proxy отправит его на онбординг. Раньше здесь бросался UNAUTHORIZED,
          // из-за чего новый аккаунт не мог получить сессию в принципе.
          if (!member) {
            return { data: session }
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
      // Вторая школа — только по приглашению. Без лимита любой аккаунт мог бы
      // нарезать организации через API мимо UI, а регистрация теперь открыта.
      organizationLimit: 1,
      organizationHooks: {
        // `checkSlug` знает только про занятость и на `admin` ответит
        // «свободен», поэтому зарезервированные адреса отсекаем сами.
        beforeCreateOrganization: async ({ organization }) => {
          // slug в хуке опционален по типам; пустая строка в набор не попадёт.
          if (RESERVED_SLUGS.has(organization.slug ?? '')) {
            throw new APIError('BAD_REQUEST', {
              message: 'Этот адрес зарезервирован — выберите другой.',
            })
          }
        },
      },
      schema: {
        member: { modelName: 'Member' },
        organization: { modelName: 'Organization' },
        invitation: { modelName: 'Invitation' },
        role: { modelName: 'OrganizationRole' },
      },
    }),
  ],
} satisfies BetterAuthOptions

/**
 * Резолвит эффективную карту прав участника для снапшота сессии.
 * - `owner` → полный доступ (неизменяем).
 * - иначе → переопределение из `OrganizationRole` (если владелец его завёл),
 *   иначе — статический дефолт роли из кода.
 * Снапшот читается синхронно и на клиенте (`useHasPermission`), и на сервере
 * (`ctx.session.permissions`), без сетевых round-trip'ов.
 */
async function resolveMemberPermissions(
  organizationId: number | null,
  role: string | null,
): Promise<{ permissions: OrganizationPermissionCheck; roleLabel: string | null }> {
  if (!organizationId || !role) {
    return { permissions: {}, roleLabel: null }
  }

  if (role === 'owner') {
    return { permissions: fullPermission, roleLabel: systemRoleLabels.owner }
  }

  const dbRole = await prisma.organizationRole.findUnique({
    where: { organizationId_role: { organizationId, role } },
  })

  const fallbackLabel = systemRoleLabels[role as OrganizationRole] ?? role

  if (dbRole) {
    let permissions: OrganizationPermissionCheck = {}
    try {
      permissions = JSON.parse(dbRole.permission) as OrganizationPermissionCheck
    } catch {
      permissions = getStaticRolePermission(role) ?? {}
    }
    return { permissions, roleLabel: dbRole.label ?? fallbackLabel }
  }

  return { permissions: getStaticRolePermission(role) ?? {}, roleLabel: fallbackLabel }
}

/**
 * Организацию запроса задаёт поддомен: страница, отрисованная на `b.eduda`,
 * обязана работать с организацией `b`, иначе `ctx.session.organizationId` в
 * server actions разойдётся с тенантом страницы и запись уйдёт в чужую школу.
 *
 * На корневом домене и на `auth.*` организации нет — там резолв отвечает на
 * другой вопрос: «куда вести пользователя». Берём последнюю активную, иначе
 * первую попавшуюся.
 */
async function resolveMember(
  userId: number,
  host: string | null | undefined,
  activeOrganizationId: string | null | undefined,
) {
  const subdomain = extractSubdomain(host)

  if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
    // Не член этой школы → `null`, и proxy уведёт на корень.
    return prisma.member.findFirst({
      where: { userId, organization: { slug: subdomain } },
      include: { organization: true },
    })
  }

  if (activeOrganizationId) {
    const active = await prisma.member.findFirst({
      where: { userId, organizationId: Number(activeOrganizationId) },
      include: { organization: true },
    })
    if (active) return active
  }

  return prisma.member.findFirst({
    where: { userId },
    include: { organization: true },
  })
}

export const auth = betterAuth({
  ...options,
  plugins: [
    ...(options.plugins ?? []),
    customSession(async ({ user, session }, ctx) => {
      // `session` в колбэке не выводит поля плагинов — отсюда каст.
      const { activeOrganizationId } = session as { activeOrganizationId?: string | null }

      const member = await resolveMember(
        Number(session.userId),
        ctx?.headers?.get('host'),
        activeOrganizationId,
      )

      const { disabledFeatures } = await getEffectiveFeatures(member?.organizationId ?? null)

      const { permissions, roleLabel } = await resolveMemberPermissions(
        member?.organizationId ?? null,
        member?.role ?? null,
      )

      return {
        user,
        session,
        organization: member?.organization ?? null,
        organizationId: member?.organizationId ?? null,
        memberRole: member?.role ?? null,
        roleLabel,
        permissions,
        userRole: user.role,
        disabledFeatures,
      }
    }, options),
    nextCookies(), // должен быть последним плагином
  ],
})

export type Session = typeof auth.$Infer.Session
export type { OrganizationRole } from '../permissions/organization'
