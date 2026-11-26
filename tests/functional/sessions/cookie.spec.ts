import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import mail from '@adonisjs/mail/services/main'
import jwt from 'jsonwebtoken'
import User from '#modules/users/models/user'
import Role from '#modules/roles/models/role'
import Tenant from '#modules/tenants/models/tenant'
import env from '#start/env'
import { JWT_COOKIE_NAME } from '#shared/jwt/constants'

const password = 'password123'

test.group('API cookie sessions', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await limiter.clear()
    mail.fake()
  })
  group.each.teardown(() => mail.restore())

  async function account() {
    const user = await User.create({
      full_name: 'Cookie user',
      email: 'cookie@example.com',
      password,
    })
    const role = await Role.findByOrFail('slug', 'user')
    await user.related('roles').attach([role.id])
    return user
  }

  test('CSRF bootstrap enables cookie sign-in without any web page', async ({ assert }) => {
    const user = await account()
    const baseUrl = `http://${env.get('HOST')}:${env.get('PORT')}`
    // Use a real cookie round-trip: Japa's session plugin creates a fresh session per request.
    const bootstrap = await fetch(`${baseUrl}/api/v1/sessions/csrf`)
    assert.equal(bootstrap.status, 200)
    const { csrf_token: csrfToken } = (await bootstrap.json()) as { csrf_token: string }
    assert.isString(csrfToken)
    const cookies = bootstrap.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .join('; ')
    const login = await fetch(`${baseUrl}/api/v1/sessions/sign-in`, {
      method: 'POST',
      headers: { 'Cookie': cookies, 'x-csrf-token': csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.email, password, auth_mode: 'cookie' }),
    })
    assert.equal(login.status, 200)
    const authCookie = login.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith(`${JWT_COOKIE_NAME}=`))!
    assert.include(authCookie.toLowerCase(), 'httponly')
    assert.include(authCookie.toLowerCase(), 'samesite=lax')
    const profile = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { Cookie: authCookie.split(';')[0] },
    })
    assert.equal(profile.status, 200)
    assert.equal(((await profile.json()) as { id: number }).id, user.id)
  })

  for (const route of ['sign-in', 'sign-up', 'refresh']) {
    test(`${route} rejects explicit cookie mode without CSRF before issuing credentials`, async ({
      client,
    }) => {
      const response = await client
        .post(`/api/v1/sessions/${route}`)
        .header('Accept', 'application/json')
        .json({ auth_mode: 'cookie' })
      response.assertStatus(403)
    })
  }

  test('default bearer sign-in does not set an access cookie', async ({ client, assert }) => {
    const user = await account()
    const login = await client.post('/api/v1/sessions/sign-in').json({ uid: user.email, password })
    login.assertStatus(200)
    assert.isUndefined(login.cookie(JWT_COOKIE_NAME))
    const profile = await client.get('/api/v1/me').bearerToken(login.body().auth.access_token)
    profile.assertStatus(200)
  })

  test('cookie registration returns usable tokens and an HttpOnly access cookie', async ({
    client,
    assert,
  }) => {
    const signup = await client.post('/api/v1/sessions/sign-up').withCsrfToken().json({
      full_name: 'Cookie registration',
      email: 'cookie-signup@example.com',
      password,
      password_confirmation: password,
      auth_mode: 'cookie',
    })
    signup.assertStatus(201)
    assert.isTrue(signup.cookie(JWT_COOKIE_NAME)!.httpOnly)
    const profile = await client
      .get('/api/v1/me')
      .cookie(JWT_COOKIE_NAME, signup.cookie(JWT_COOKIE_NAME)!.value)
    profile.assertStatus(200)
    assert.equal(profile.body().id, signup.body().id)
  })

  test('cookie refresh and logout require CSRF even with an Authorization header', async ({
    client,
    assert,
  }) => {
    const user = await account()
    const login = await client
      .post('/api/v1/sessions/sign-in')
      .withCsrfToken()
      .json({ uid: user.email, password, auth_mode: 'cookie' })
    login.assertStatus(200)
    const cookie = login.cookie(JWT_COOKIE_NAME)!.value
    for (const route of ['refresh', 'logout']) {
      const denied = await client
        .post(`/api/v1/sessions/${route}`)
        .cookie(JWT_COOKIE_NAME, cookie)
        .header('Authorization', 'Basic invalid')
        .header('Accept', 'application/json')
        .json({ refresh_token: login.body().auth.refresh_token })
      denied.assertStatus(403)
    }
    const refreshed = await client
      .post('/api/v1/sessions/refresh')
      .cookie(JWT_COOKIE_NAME, cookie)
      .withCsrfToken()
      .json({ refresh_token: login.body().auth.refresh_token, auth_mode: 'cookie' })
    refreshed.assertStatus(200)
    assert.equal(refreshed.cookie(JWT_COOKIE_NAME)!.value, refreshed.body().auth.access_token)
    assert.notEqual(refreshed.body().auth.refresh_token, login.body().auth.refresh_token)
    const logout = await client
      .post('/api/v1/sessions/logout')
      .cookie(JWT_COOKIE_NAME, refreshed.cookie(JWT_COOKIE_NAME)!.value)
      .withCsrfToken()
      .json({ refresh_token: refreshed.body().auth.refresh_token })
    logout.assertStatus(204)
    assert.equal(logout.cookie(JWT_COOKIE_NAME)!.value, '')
    const replay = await client
      .post('/api/v1/sessions/refresh')
      .json({ refresh_token: refreshed.body().auth.refresh_token })
    replay.assertStatus(401)
  })

  test('tenant creation and switching replace the cookie with the selected tenant claim', async ({
    client,
    assert,
  }) => {
    const user = await account()
    const other = await Tenant.create({ name: 'Other workspace', slug: 'cookie-other' })
    await user.related('tenants').attach([other.id])
    const login = await client
      .post('/api/v1/sessions/sign-in')
      .withCsrfToken()
      .json({ uid: user.email, password, auth_mode: 'cookie' })
    login.assertStatus(200)
    const created = await client
      .post('/api/v1/tenants')
      .cookie(JWT_COOKIE_NAME, login.cookie(JWT_COOKIE_NAME)!.value)
      .withCsrfToken()
      .json({ name: 'New workspace' })
    created.assertStatus(201)
    assert.equal(
      (jwt.decode(created.cookie(JWT_COOKIE_NAME)!.value) as { tenantId: number }).tenantId,
      created.body().tenant.id
    )
    const switched = await client
      .post('/api/v1/tenants/switch')
      .cookie(JWT_COOKIE_NAME, created.cookie(JWT_COOKIE_NAME)!.value)
      .withCsrfToken()
      .json({ tenant_id: other.id })
    switched.assertStatus(200)
    assert.equal(
      (jwt.decode(switched.cookie(JWT_COOKIE_NAME)!.value) as { tenantId: number }).tenantId,
      other.id
    )
    const refreshed = await client
      .post('/api/v1/sessions/refresh')
      .withCsrfToken()
      .json({ refresh_token: switched.body().auth.refresh_token, auth_mode: 'cookie' })
    refreshed.assertStatus(200)
    assert.equal(
      (jwt.decode(refreshed.cookie(JWT_COOKIE_NAME)!.value) as { tenantId: number }).tenantId,
      other.id
    )
  })
})
