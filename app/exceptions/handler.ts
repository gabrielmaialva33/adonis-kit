import app from '@adonisjs/core/services/app'
import { ExceptionHandler, type HttpContext } from '@adonisjs/core/http'
import type { HttpError } from '@adonisjs/core/types/http'
import { errors as authErrors } from '@adonisjs/auth'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  protected renderStatusPages = false

  // API errors never negotiate an HTML page, including unknown routes.
  renderError(error: HttpError, ctx: HttpContext) {
    return this.renderErrorAsJSON(error, ctx)
  }

  renderValidationError(error: HttpError, ctx: HttpContext) {
    return this.renderValidationErrorAsJSON(error, ctx)
  }

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    // Auth exceptions have their own content negotiation and bypass renderError.
    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      return ctx.response.unauthorized({
        errors: [{ message: error.getResponseMessage(error, ctx) }],
      })
    }

    // Shield's default HTML redirect is unsuitable for API consumers.
    if (
      ctx.request.url().startsWith('/api/') &&
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'E_BAD_CSRF_TOKEN'
    ) {
      return ctx.response.forbidden({
        errors: [{ code: 'E_BAD_CSRF_TOKEN', message: 'Invalid or expired CSRF token' }],
      })
    }

    /**
     * Handle rate limiting errors
     */
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'E_TOO_MANY_REQUESTS'
    ) {
      const rateLimitError = error as any

      // Set rate limit headers from the response object
      if (rateLimitError.response) {
        ctx.response.header('x-ratelimit-limit', rateLimitError.response.limit)
        ctx.response.header('x-ratelimit-remaining', rateLimitError.response.remaining)
        ctx.response.header('retry-after', rateLimitError.response.availableIn)
      }

      return ctx.response.status(429).json({
        errors: [
          {
            code: 'E_TOO_MANY_REQUESTS',
            message: rateLimitError.message || 'Too many requests',
            status: 429,
          },
        ],
      })
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
