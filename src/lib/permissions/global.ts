import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access'

const ac = createAccessControl(defaultStatements)

const user = ac.newRole({
  ...userAc.statements,
})

const admin = ac.newRole({
  ...adminAc.statements,
})

const owner = ac.newRole({
  ...userAc.statements,
  ...adminAc.statements,
})

export default { ac, roles: { user, admin, owner } }
