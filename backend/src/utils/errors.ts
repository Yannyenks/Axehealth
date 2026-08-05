export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    super(404, id ? `${resource} introuvable: ${id}` : `${resource} introuvable`, 'NOT_FOUND')
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Non autorisé') {
    super(401, message, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Accès refusé') {
    super(403, message, 'FORBIDDEN')
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details)
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT')
  }
}

export class BusinessError extends ApiError {
  constructor(message: string, code?: string) {
    super(422, message, code || 'BUSINESS_RULE_VIOLATION')
  }
}
