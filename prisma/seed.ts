import prisma from '@/src/lib/db/prisma'
import { hashPassword } from 'better-auth/crypto'

const createAccounts = async () => {
  const users = await prisma.user.findMany({
    where: {
      accounts: { none: {} },
    },
  })

  for (const user of users) {
    const pass = await hashPassword('Sunaza.45')
    await prisma.account.create({
      data: {
        providerId: 'credential',
        userId: user.id,
        accountId: user.id.toString(),
        password: pass,
      },
    })
  }
}

createAccounts()
