import { BaseMail } from '@adonisjs/mail'
import type { DateTime } from 'luxon'

import type User from '#modules/users/models/user'
import env from '#start/env'

export default class PasswordResetNotification extends BaseMail {
  subject = 'Reset your password'

  constructor(
    private user: User,
    private token: string,
    private expiresAt: DateTime
  ) {
    super()
  }

  getResetToken() {
    return this.token
  }

  prepare() {
    const appName = env.get('MAIL_FROM_NAME', env.get('APP_NAME', 'Adonis Kit'))
    const frontendUrl = env.get('PASSWORD_RESET_URL')
    const destination = frontendUrl ? new URL(frontendUrl) : undefined
    destination?.searchParams.set('token', this.token)
    const resetUrl = destination?.toString()
    const resetEndpoint = new URL(
      '/api/v1/sessions/reset-password',
      env.get('APP_URL', 'http://localhost:3333')
    ).toString()
    const expiresInMinutes = Math.max(1, Math.ceil(this.expiresAt.diffNow('minutes').minutes))

    this.message.from(env.get('MAIL_FROM_ADDRESS', 'noreply@example.com'), appName)
    this.message.to(this.user.email, this.user.full_name)

    this.message.htmlView('emails/password_reset_html', {
      user: this.user,
      resetUrl,
      resetEndpoint,
      token: this.token,
      appName,
      expiresInMinutes,
    })
    this.message.textView('emails/password_reset_text', {
      user: this.user,
      resetUrl,
      resetEndpoint,
      token: this.token,
      appName,
      expiresInMinutes,
    })
  }
}
