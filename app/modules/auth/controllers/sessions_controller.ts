import { type HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import JwtAuthTokensService from '#modules/auth/services/jwt_auth_tokens_service'
import SignInService from '#modules/auth/services/sign_in_service'
import SignUpService from '#modules/auth/services/sign_up_service'
import { refreshSessionValidator } from '#modules/auth/validators/session_validator'
import { createUserValidator, signInValidator } from '#modules/users/validators/users_validator'
import { setAccessTokenCookie } from '#shared/jwt/cookie'
import { JWT_COOKIE_NAME } from '#shared/jwt/constants'

export default class SessionsController {
  async csrf({ request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    return response.ok({ csrf_token: request.csrfToken })
  }

  async signIn(ctx: HttpContext) {
    const { request, response } = ctx
    const { uid, password, auth_mode: authMode } = await request.validateUsing(signInValidator)

    try {
      const service = await app.container.make(SignInService)
      const { user, auth } = await service.run({ uid, password, ctx })

      if (!auth) {
        throw new Error('Authentication tokens were not issued')
      }

      if (authMode === 'cookie') setAccessTokenCookie(response, auth.access_token)
      return response.json({ ...user.toJSON(), auth })
    } catch (error) {
      return response.badRequest({
        errors: [
          {
            message: error instanceof Error ? error.message : 'Invalid credentials',
          },
        ],
      })
    }
  }

  async signUp({ request, response }: HttpContext) {
    const { auth_mode: authMode, ...payload } = await request.validateUsing(createUserValidator)
    const service = await app.container.make(SignUpService)
    const { user, auth, emailVerificationSent } = await service.run(payload)

    if (!auth) {
      throw new Error('Authentication tokens were not issued')
    }

    if (authMode === 'cookie') setAccessTokenCookie(response, auth.access_token)
    return response.created({
      ...user.toJSON(),
      auth,
      email_verification_sent: emailVerificationSent,
    })
  }

  async refresh({ request, response }: HttpContext) {
    const { refresh_token: refreshToken, auth_mode: authMode } =
      await request.validateUsing(refreshSessionValidator)
    const service = await app.container.make(JwtAuthTokensService)
    const auth = await service.refresh(refreshToken)

    if (authMode === 'cookie') setAccessTokenCookie(response, auth.access_token)
    return response.ok({ auth })
  }

  async logout({ request, response }: HttpContext) {
    const { refresh_token: refreshToken } = await request.validateUsing(refreshSessionValidator)
    const service = await app.container.make(JwtAuthTokensService)
    await service.revoke(refreshToken)
    response.clearCookie(JWT_COOKIE_NAME, { path: '/' })

    return response.noContent()
  }
}
