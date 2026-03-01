import {
  adminClient,
  customSessionClient,
  inferAdditionalFields,
  organizationClient,
} from 'better-auth/client/plugins'
import { nextCookies } from 'better-auth/next-js'
import { createAuthClient } from 'better-auth/react'

import global from '../permissions/global'
import organization from '../permissions/organization'
import type { auth } from './server'

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    nextCookies(),
    customSessionClient<typeof auth>(),
    adminClient({ ...global }),
    organizationClient({ ...organization }),
  ],
})
