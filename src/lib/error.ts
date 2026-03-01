import 'server-only'

/**
 * Базовый класс ошибок для server actions.
 */
export abstract class ActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActionError'
  }
}

export class UnauthorizedError extends ActionError {
  constructor(message = 'Необходима авторизация') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends ActionError {
  constructor(message = 'Недостаточно прав') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends ActionError {
  constructor(message = 'Ресурс не найден') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends ActionError {
  constructor(message = 'Конфликт данных') {
    super(message)
    this.name = 'ConflictError'
  }
}
