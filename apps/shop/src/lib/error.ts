/**
 * Базовый класс ошибок для server actions — тот же контракт, что в платформе:
 * `handleServerError` пропускает `message` наследников как есть, всё остальное
 * схлопывается в generic-сообщение.
 */
export abstract class ActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActionError'
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

/** Состояние изменилось под руками: награда уже забрана, условие ещё не выполнено. */
export class ConflictError extends ActionError {
  constructor(message = 'Действие больше неактуально') {
    super(message)
    this.name = 'ConflictError'
  }
}
