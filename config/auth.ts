import { defineConfig } from '@adonisjs/auth'
import type { Authenticators, InferAuthenticators, InferAuthEvents } from '@adonisjs/auth/types'
import { sessionUserProvider } from '@adonisjs/auth/session'

import { jwtGuard } from '#shared/jwt/define_config'
import {
  JWT_AUDIENCE,
  JWT_COOKIE_NAME,
  JWT_ISSUER,
  API_ACCESS_TOKEN_EXPIRES_IN,
} from '#shared/jwt/constants'
import type UserModel from '#modules/users/models/user'
import type { JwtGuardUser } from '#shared/jwt/types'
import env from '#start/env'

const authConfig = defineConfig({
  default: 'jwt',
  guards: {
    jwt: jwtGuard({
      secret: env.get('ACCESS_TOKEN_SECRET', env.get('APP_KEY')),
      tokenExpiresIn: API_ACCESS_TOKEN_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      useCookies: true,
      cookieName: JWT_COOKIE_NAME,
      provider: sessionUserProvider({
        model: () => import('#modules/users/models/user'),
      }),
      content: <User>(user: JwtGuardUser<User>) => ({
        authVersion: (user.getOriginal() as UserModel).auth_version,
      }),
    }),
  },
})

export default authConfig

declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}

declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
