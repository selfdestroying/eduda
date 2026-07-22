import type { Prisma } from '@repo/db'
import { betterAuth } from 'better-auth'
import { encryptStudentPassword } from './student-password'

/**
 * Учётка ученика для входа в `apps/shop`. Там свой инстанс better-auth, но
 * создаётся учётка только здесь: самостоятельной регистрации у учеников нет.
 *
 * Хеш обязан сойтись с инстансом ШОПА, а не платформы, поэтому считается
 * отдельным минимальным инстансом на дефолтных настройках — ровно тем, что
 * будет проверять пароль на входе. Привязка к `auth` платформы сломала бы вход
 * учеников в тот день, когда платформа настроит своё хеширование.
 */
let hasher: Promise<(password: string) => Promise<string>> | null = null

export async function hashStudentPassword(plain: string): Promise<string> {
  hasher ??= betterAuth({ secret: process.env.BETTER_AUTH_SECRET }).$context.then(
    (ctx) => ctx.password.hash,
  )
  return (await hasher)(plain)
}

/** Синтетический e-mail: вход идёт по username, почты у ученика нет. */
export function studentEmail(login: string): string {
  return `${login.toLowerCase()}@student.invalid`
}

/**
 * Создаёт `StudentUser` + `StudentCredential` и отдаёт то, что нужно записать в
 * `StudentAccount`. Вызывается внутри той же транзакции, что и создание ученика.
 *
 * `hash` можно передать готовым — сид гоняет один и тот же демо-пароль на
 * десятки учеников, и scrypt на каждого не укладывается в лимит времени роута
 * сброса демо.
 */
export async function createStudentUserTx(
  tx: Prisma.TransactionClient,
  args: { login: string; password: string; name: string; hash?: string },
): Promise<{ studentUserId: number; passwordEnc: Uint8Array<ArrayBuffer> }> {
  const hash = args.hash ?? (await hashStudentPassword(args.password))

  const user = await tx.studentUser.create({
    data: {
      name: args.name,
      email: studentEmail(args.login),
      emailVerified: true,
      // better-auth ищет по username в нижнем регистре, поэтому канонический вид
      // хранится здесь, а исходное написание логина — в displayUsername. Иначе
      // ученик с логином вида «Ivanov» не смог бы войти вообще.
      username: args.login.toLowerCase(),
      displayUsername: args.login,
    },
    select: { id: true },
  })

  await tx.studentCredential.create({
    data: {
      userId: user.id,
      providerId: 'credential',
      accountId: String(user.id),
      password: hash,
    },
  })

  return { studentUserId: user.id, passwordEnc: encryptStudentPassword(args.password) }
}
