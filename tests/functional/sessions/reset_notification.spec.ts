import { test } from '@japa/runner'
import { mock } from 'node:test'
import { DateTime } from 'luxon'
import PasswordResetNotification from '#modules/auth/services/password_reset_notification'
import User from '#modules/users/models/user'
import env from '#start/env'

test.group('Password reset email destinations', (group) => {
  group.each.teardown(() => mock.restoreAll())

  for (const destination of [undefined, 'https://frontend.example/reset?locale=pt']) {
    test(`renders the real email templates with ${destination ? 'a frontend URL' : 'API instructions'}`, async ({
      assert,
    }) => {
      const originalGet = env.get.bind(env)
      mock.method(env, 'get', (key: string, fallback: unknown) =>
        key === 'PASSWORD_RESET_URL' ? destination : originalGet(key as never, fallback as never)
      )
      const user = new User()
      user.full_name = '<script>untrusted name</script>'
      user.email = 'notification@example.com'
      const token = 'synthetic_opaque_reset_token_0123456789'
      const notification = new PasswordResetNotification(
        user,
        token,
        DateTime.now().plus({ minutes: 60 })
      )
      await notification.buildWithContents()
      const { message, views } = notification.message.toJSON()
      assert.isNotEmpty(views)
      const html = String(message.html)
      const text = String(message.text)
      assert.notInclude(html, '<script>untrusted name</script>')
      assert.include(html, token)
      assert.include(text, token)
      if (destination) {
        assert.include(text, `https://frontend.example/reset?locale=pt&token=${token}`)
        assert.include(html, 'https://frontend.example/reset?locale=pt')
      } else {
        assert.include(html, '/api/v1/sessions/reset-password')
        assert.include(text, 'POST ')
        assert.include(text, 'password_confirmation')
        assert.notInclude(html, '/reset-password?token=')
      }
    })
  }
})
