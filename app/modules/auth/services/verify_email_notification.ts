import { BaseMail } from '@adonisjs/mail'
import env from '#start/env'
import type User from '#modules/users/models/user'

export default class VerifyEmailNotification extends BaseMail {
  subject = 'Verify your email address'

  constructor(
    private user: User,
    private token: string
  ) {
    super()
  }

  getVerificationToken() {
    return this.token
  }

  /**
   * The "prepare" method is called automatically when
   * the email is sent or queued.
   */
  prepare() {
    const verificationUrl = `${env.get('APP_URL', 'http://localhost:3333')}/api/v1/verify-email?token=${this.token}`

    // Set the sender of the email
    this.message.from(
      env.get('MAIL_FROM_ADDRESS', 'noreply@example.com'),
      env.get('MAIL_FROM_NAME', 'Adonis Kit')
    )

    // Set the recipient of the email
    this.message.to(this.user.email, this.user.full_name)

    this.message.htmlView('emails/verify_email_html', {
      user: this.user,
      verificationUrl,
      appName: env.get('MAIL_FROM_NAME', 'Adonis Kit'),
    })
    this.message.textView('emails/verify_email_text', {
      user: this.user,
      verificationUrl,
      appName: env.get('MAIL_FROM_NAME', 'Adonis Kit'),
    })
  }
}
