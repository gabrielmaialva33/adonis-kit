import { test } from '@japa/runner'

test.group('API-only response contract', () => {
  test('missing endpoints return JSON even when HTML is requested', async ({ client }) => {
    const response = await client.get('/api/v1/not-a-route').header('Accept', 'text/html')
    response.assertStatus(404)
    response.assertHeader('content-type', 'application/json; charset=utf-8')
  })

  test('invalid input returns 422 JSON without a redirect or Accept negotiation', async ({
    client,
  }) => {
    const response = await client
      .post('/api/v1/sessions/sign-in')
      .header('Accept', 'text/html')
      .redirects(0)
      .json({})
    response.assertStatus(422)
    response.assertHeader('content-type', 'application/json; charset=utf-8')
    response.assertBodyContains({ errors: [{ field: 'uid', rule: 'required' }] })
  })

  test('removed UI routes are unavailable', async ({ client }) => {
    for (const path of ['/', '/login', '/register', '/dashboard', '/settings', '/ui-demo']) {
      const response = await client.get(path).redirects(0)
      response.assertStatus(404)
    }
  })

  test('unauthenticated HTML clients receive JSON 401 without a login redirect', async ({
    client,
  }) => {
    const response = await client.get('/api/v1/me').header('Accept', 'text/html').redirects(0)
    response.assertStatus(401)
    response.assertHeader('content-type', 'application/json; charset=utf-8')
  })
})
