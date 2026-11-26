import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { Env } from '@adonisjs/core/env'
import { test } from '@japa/runner'
import { envSchema } from '#start/env_schema'
import { parseGcsCredentials } from '#shared/services/gcs_credentials'

const root = new URL('../../../', import.meta.url)

async function loadFixture(name: string) {
  // Parse only the tracked file: shell/CI variables and local .env must not mask drift.
  return parseEnv(await readFile(new URL(name, root), 'utf8'))
}

for (const name of ['.env.test', '.env.example']) {
  test(`${name} satisfies the startup schema without ambient environment values`, async () => {
    const values = await loadFixture(name)
    if (name === '.env.example') {
      // The one intentional setup step is generating APP_KEY; never ship a real key.
      assert.equal(values.APP_KEY, '')
      values.APP_KEY = 'synthetic_fixture_validation_key_32_chars'
    }
    assert.doesNotThrow(() => Env.rules(envSchema).validate(values))
    assert.doesNotThrow(() => parseGcsCredentials(values.GCS_KEY))
  })

  test(`${name} contains no undeclared or retired variables`, async () => {
    const values = await loadFixture(name)
    const unknown = Object.keys(values).filter((key) => !Object.hasOwn(envSchema, key))
    assert.deepEqual(unknown, [], `Undeclared variables in ${name}: ${unknown.join(', ')}`)
  })
}

test('test mail cannot discover a developer SMTP service when delivery is not faked', async () => {
  const values = await loadFixture('.env.test')
  assert.equal(values.MAIL_MAILER, 'smtp')
  assert.equal(values.SMTP_HOST, '127.0.0.1')
  assert.equal(values.SMTP_PORT, '9')
  assert.ok(!values.SMTP_USER)
  assert.ok(!values.SMTP_PASS)
})
