import assert from 'node:assert/strict'
import { test } from '@japa/runner'
import { setupSyntheticGcsCredentials } from '#tests/helpers/synthetic_gcs_credentials'
import { parseGcsCredentials } from '#shared/services/gcs_credentials'

test.group('Backend test GCS credentials', () => {
  test('supplies valid synthetic credentials when no process override exists', () => {
    const environment: NodeJS.ProcessEnv = {}
    setupSyntheticGcsCredentials(environment)
    const credentials = parseGcsCredentials(environment.GCS_KEY)
    assert.ok(credentials)
    assert.equal(credentials.type, 'service_account')
    assert.equal(credentials.project_id, 'synthetic-test-project')
    assert.equal(
      credentials.client_email,
      'synthetic@synthetic-test-project.iam.gserviceaccount.com'
    )
    assert.match(credentials.private_key, /^-----BEGIN PRIVATE KEY-----/)
  })

  test('preserves credentials explicitly supplied by the caller', () => {
    const environment: NodeJS.ProcessEnv = {}
    setupSyntheticGcsCredentials(environment)
    const explicitlySupplied = environment.GCS_KEY
    assert.ok(explicitlySupplied)
    setupSyntheticGcsCredentials(environment)
    assert.equal(environment.GCS_KEY, explicitlySupplied)
    assert.ok(parseGcsCredentials(environment.GCS_KEY))
  })

  for (const value of ['explicit-invalid-value', '']) {
    test(`preserves invalid explicit credentials ${JSON.stringify(value)} for startup rejection`, () => {
      const environment: NodeJS.ProcessEnv = { GCS_KEY: value }
      setupSyntheticGcsCredentials(environment)
      assert.equal(environment.GCS_KEY, value)
      assert.throws(() => parseGcsCredentials(environment.GCS_KEY), /GCS_KEY.*JSON/)
    })
  }
})
