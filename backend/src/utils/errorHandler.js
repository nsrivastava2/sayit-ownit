/**
 * Sanitize error message for production
 * Hides database and internal error details from clients
 */
export function sanitizeError(error) {
  const message = error.message || 'An error occurred';

  // In development, return full error
  if (process.env.NODE_ENV === 'development') {
    return message;
  }

  // In production, hide sensitive error details
  const sensitivePatterns = [
    /invalid input syntax/i,
    /syntax error/i,
    /relation .* does not exist/i,
    /column .* does not exist/i,
    /duplicate key/i,
    /violates .* constraint/i,
    /connection refused/i,
    /ECONNREFUSED/i,
    /timeout/i,
    /postgresql/i,
    /redis/i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(message)) {
      console.error('[ERROR] Sanitized error:', message);
      return 'An error occurred while processing your request';
    }
  }

  return message;
}

/**
 * Standard error response helper
 */
export function errorResponse(res, error, statusCode = 500) {
  console.error('API Error:', error);
  res.status(statusCode).json({
    error: sanitizeError(error)
  });
}
