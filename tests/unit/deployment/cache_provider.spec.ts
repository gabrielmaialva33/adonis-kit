import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'

test('configured cache stores are available to services and Ace commands', async ({ assert }) => {
  const cache = await app.container.make('cache.manager')
  const store = cache.use('memoryOnly')
  await store.set({ key: 'provider-regression', value: 'available' })
  try {
    assert.equal(await store.get({ key: 'provider-regression' }), 'available')
  } finally {
    await store.delete({ key: 'provider-regression' })
  }
})
