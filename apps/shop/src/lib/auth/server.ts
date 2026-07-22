import { prismaAdapter } from '@better-auth/prisma-adapter'
import { prisma } from '@repo/db'
import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { username } from 'better-auth/plugins'

/**
 * Второй, независимый инстанс better-auth — для учеников.
 *
 * Живёт на своих таблицах (`Student*`) и под своим `cookiePrefix`, поэтому
 * сессия ученика и сессия сотрудника не пересекаются даже на одном браузере.
 * `crossSubDomainCookies` намеренно выключен: домен единый (`shop.{rootDomain}`),
 * растекаться на поддомены школ куке ученика незачем.
 *
 * Регистрации нет: аккаунт заводит только staff в платформе
 * (`apps/platform/src/lib/student-auth.ts`).
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  user: { modelName: 'StudentUser' },
  session: { modelName: 'StudentSession' },
  account: { modelName: 'StudentCredential' },
  verification: { modelName: 'StudentVerification' },
  emailAndPassword: {
    // Провайдер `credential` нужен плагину `username` для проверки пароля,
    // а сама регистрация закрыта.
    enabled: true,
    disableSignUp: true,
  },
  rateLimit: { enabled: true },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'edu_student',
    database: { generateId: 'serial' },
  },
  plugins: [
    // Формат логина принадлежит платформе, а не этому плагину: школы уже раздали
    // логины с дефисами, точками, заглавными и даже кириллицей. Дефолтный
    // валидатор (`/^[a-zA-Z0-9_.]+$/`, длина 3–30) отсёк бы этих учеников от
    // входа, поэтому проверку снимаем — она здесь ничего не защищает, логин
    // только ищется в БД параметризованным запросом.
    username({ minUsernameLength: 1, maxUsernameLength: 64, usernameValidator: () => true }),
    nextCookies(), // должен быть последним плагином
  ],
})
