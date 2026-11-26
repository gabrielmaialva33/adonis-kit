import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import { JWT_COOKIE_NAME } from '#shared/jwt/constants'

export function setAccessTokenCookie(response: HttpContext['response'], token: string) {
  response.cookie(JWT_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
    maxAge: '15m',
  })
}

export function usesCookieAuthentication(request: HttpContext['request']) {
  return !request.header('authorization') && Boolean(request.cookie(JWT_COOKIE_NAME))
}
