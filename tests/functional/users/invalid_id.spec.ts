import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#modules/users/models/user'
import Role from '#modules/roles/models/role'

test.group('User identifier validation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  for (const id of ['0', 'NaN', 'abc', '-1', '1.5']) {
    test(`rejects ${id} without reading, modifying or deleting another user`, async ({
      client,
      assert,
    }) => {
      const root = await User.create({
        full_name: 'Root',
        email: 'id-root@example.com',
        password: 'password123',
      })
      const role = await Role.findByOrFail('slug', 'root')
      await root.related('roles').attach([role.id])
      const target = await User.create({
        full_name: 'Untouched',
        email: 'id-target@example.com',
        password: 'password123',
      })
      const before = await User.query().count('* as total')
      const get = await client
        .get(`/api/v1/users/${id}`)
        .loginAs(root)
        .header('Accept', 'application/json')
      get.assertStatus(404)
      const update = await client
        .put(`/api/v1/users/${id}`)
        .loginAs(root)
        .header('Accept', 'application/json')
        .json({ full_name: 'Changed' })
      update.assertStatus(404)
      const remove = await client
        .delete(`/api/v1/users/${id}`)
        .loginAs(root)
        .header('Accept', 'application/json')
      remove.assertStatus(404)
      await target.refresh()
      assert.equal(target.full_name, 'Untouched')
      assert.isFalse(target.is_deleted)
      const after = await User.query().count('* as total')
      assert.equal(after[0].$extras.total, before[0].$extras.total)
    })
  }
})
