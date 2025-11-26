/**
 * Custom Error Classes for Better Error Handling
 */

/**
 * Base Application Error
 */
class ApplicationError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Payment-specific errors
 */
class PaymentError extends ApplicationError {
  constructor(message, code = 'PAYMENT_ERROR') {
    super(message, 400, code);
  }
}

class PaymentProviderError extends PaymentError {
  constructor(provider, message) {
    super(`Payment provider error (${provider}): ${message}`, 'PROVIDER_ERROR');
    this.provider = provider;
  }
}

class PaymentNotFoundError extends PaymentError {
  constructor(paymentId) {
    super(`Payment not found: ${paymentId}`, 'PAYMENT_NOT_FOUND');
    this.paymentId = paymentId;
  }
}

class DuplicatePaymentError extends PaymentError {
  constructor(paymentId) {
    super(`Payment already processed: ${paymentId}`, 'DUPLICATE_PAYMENT');
    this.paymentId = paymentId;
    this.statusCode = 409;
  }
}

class InvalidSignatureError extends PaymentError {
  constructor(provider) {
    super(`Invalid webhook signature from ${provider}`, 'INVALID_SIGNATURE');
    this.provider = provider;
    this.statusCode = 401;
  }
}

/**
 * Validation errors
 */
class ValidationError extends ApplicationError {
  constructor(message, field = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

/**
 * Database errors
 */
class DatabaseError extends ApplicationError {
  constructor(message, operation = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.operation = operation;
  }
}

/**
 * Resource not found
 */
class NotFoundError extends ApplicationError {
  constructor(resource, identifier = null) {
    super(`${resource} not found${identifier ? `: ${identifier}` : ''}`, 404, 'NOT_FOUND');
    this.resource = resource;
    this.identifier = identifier;
  }
}

/**
 * Authorization errors
 */
class UnauthorizedError extends ApplicationError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends ApplicationError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Rate limiting errors
 */
class RateLimitError extends ApplicationError {
  constructor(retryAfter = null) {
    super('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }
}

/**
 * Configuration errors
 */
class ConfigurationError extends ApplicationError {
  constructor(configKey) {
    super(`Missing or invalid configuration: ${configKey}`, 500, 'CONFIGURATION_ERROR');
    this.configKey = configKey;
  }
}

/**
 * External service errors
 */
class ExternalServiceError extends ApplicationError {
  constructor(service, message) {
    super(`External service error (${service}): ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

/**
 * Check if error is operational (safe to expose to user)
 */
function isOperationalError(error) {
  if (error instanceof ApplicationError) {
    return error.isOperational;
  }
  return false;
}

module.exports = {
  ApplicationError,
  PaymentError,
  PaymentProviderError,
  PaymentNotFoundError,
  DuplicatePaymentError,
  InvalidSignatureError,
  ValidationError,
  DatabaseError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  ConfigurationError,
  ExternalServiceError,
  isOperationalError,
};
