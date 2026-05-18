export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    details?: unknown
  ) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Object.setPrototypeOf(this, new.target.prototype);

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 - Bad Request
 */
export class BadRequestError extends AppError {
  constructor(
    message = "Bad request",
    code = "BAD_REQUEST",
    details?: unknown
  ) {
    super(message, 400, code, details);
  }
}

/**
 * 400 - Validation Error
 */
export class ValidationError extends AppError {
  constructor(
    details?: unknown,
    message = "Validation failed",
    code = "VALIDATION_ERROR"
  ) {
    super(message, 400, code, details);
  }
}

/**
 * 401 - Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(
    message = "Unauthorized",
    code = "UNAUTHORIZED",
    details?: unknown
  ) {
    super(message, 401, code, details);
  }
}

/**
 * 401 - Invalid Credentials
 */
export class InvalidCredentialsError extends AppError {
  constructor(
    message = "Invalid email or password",
    code = "INVALID_CREDENTIALS"
  ) {
    super(message, 401, code);
  }
}

/**
 * 401 - Token Expired
 */
export class TokenExpiredError extends AppError {
  constructor(
    message = "Session expired",
    code = "TOKEN_EXPIRED"
  ) {
    super(message, 401, code);
  }
}

/**
 * 403 - Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(
    message = "Forbidden",
    code = "FORBIDDEN",
    details?: unknown
  ) {
    super(message, 403, code, details);
  }
}

/**
 * 404 - Not Found
 */
export class NotFoundError extends AppError {
  constructor(
    message = "Resource not found",
    code = "NOT_FOUND",
    details?: unknown
  ) {
    super(message, 404, code, details);
  }
}

/**
 * 409 - Conflict
 */
export class ConflictError extends AppError {
  constructor(
    message = "Conflict",
    code = "CONFLICT",
    details?: unknown
  ) {
    super(message, 409, code, details);
  }
}

/**
 * 500 - Internal Server Error
 */
export class InternalServerError extends AppError {
  constructor(
    message = "Something went wrong",
    code = "INTERNAL_SERVER_ERROR",
    details?: unknown
  ) {
    super(message, 500, code, details);
  }
}