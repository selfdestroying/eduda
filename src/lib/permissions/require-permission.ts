import 'server-only'

import { headers } from 'next/headers'
import { auth } from '../auth/server'
import { ForbiddenError } from '../error'
import { type OrganizationAction, type OrganizationStatementKeys } from './organization'

/**
 * Проверяет, имеет ли роль участника организации право
 * на выполнение действия над ресурсом.
 *
 * Бросает ForbiddenError при отсутствии прав.
 *
 * @example
 * requirePermission('manager', 'group', 'create')
 * requirePermission('teacher', 'lesson', 'readAll') // throws ForbiddenError
 */
export async function requirePermission<R extends OrganizationStatementKeys>(
  resource: R,
  action: OrganizationAction<R>,
): Promise<void> {
  const { success } = await auth.api.hasPermission({
    headers: await headers(),
    body: {
      permissions: {
        [resource]: action,
      },
    },
  })

  if (!success) {
    throw new ForbiddenError(`Недостаточно прав для действия ${action} над ресурсом ${resource}`)
  }
}
