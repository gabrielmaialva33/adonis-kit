import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import driveConfig from '#config/drive'
import env from '#start/env'
import { parseGcsCredentials } from '#shared/services/gcs_credentials'

// Locally generated only; this key belongs to no cloud account.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const serviceAccount = {
  type: 'service_account',
  project_id: 'synthetic-project',
  client_email: 'synthetic@synthetic-project.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
}

test.group('GCS configuration', () => {
  test('parses service-account JSON into a credential object', () => {
    assert.deepEqual(parseGcsCredentials(JSON.stringify(serviceAccount)), serviceAccount)
  })

  test('wires parsed credentials, private visibility and bucket into the real configured driver', async () => {
    const resolved = await driveConfig.resolver(app)
    // Construction is lazy and does not authenticate. Never call this disk's operations.
    const options = resolved.config.services.gcs().options
    assert.equal(options.visibility, 'private')
    assert.equal(options.bucket, env.get('GCS_BUCKET', ''))
    assert.ok('credentials' in options)
    assert.deepEqual(options.credentials, parseGcsCredentials(env.get('GCS_KEY')))
  })

  test('leaves credentials undefined for ADC when GCS_KEY is absent without discovering credentials', () => {
    assert.equal(parseGcsCredentials(undefined), undefined)
  })

  const invalidCases: [string, string, RegExp][] = [
    ['malformed JSON', '{"private_key":"SENSITIVE_SYNTHETIC_VALUE"', /GCS_KEY.*JSON/],
    ['empty string', '', /GCS_KEY.*JSON/],
    ['null', 'null', /GCS_KEY.*object/],
    ['array', '[]', /GCS_KEY.*object/],
    ['string', '"SENSITIVE_SYNTHETIC_VALUE"', /GCS_KEY.*object/],
    ['number', '42', /GCS_KEY.*object/],
    ['boolean', 'true', /GCS_KEY.*object/],
    [
      'missing type',
      JSON.stringify({ ...serviceAccount, type: undefined }),
      /GCS_KEY.*service_account/,
    ],
    [
      'external credentials',
      JSON.stringify({ ...serviceAccount, type: 'external_account' }),
      /GCS_KEY.*service_account/,
    ],
    [
      'user credentials',
      JSON.stringify({ ...serviceAccount, type: 'authorized_user' }),
      /GCS_KEY.*service_account/,
    ],
    ...(['project_id', 'client_email', 'private_key'] as const).flatMap<[string, string, RegExp]>(
      (field) => [
        [
          `missing ${field}`,
          JSON.stringify({ ...serviceAccount, [field]: undefined }),
          new RegExp(`GCS_KEY.*${field}`),
        ],
        [
          `empty ${field}`,
          JSON.stringify({ ...serviceAccount, [field]: '  ' }),
          new RegExp(`GCS_KEY.*${field}`),
        ],
        [
          `non-string ${field}`,
          JSON.stringify({ ...serviceAccount, [field]: 42 }),
          new RegExp(`GCS_KEY.*${field}`),
        ],
      ]
    ),
    [
      'invalid private key',
      JSON.stringify({ ...serviceAccount, private_key: 'SENSITIVE_SYNTHETIC_VALUE' }),
      /GCS_KEY.*private_key/,
    ],
    [
      'non-RSA key',
      JSON.stringify({
        ...serviceAccount,
        private_key: generateKeyPairSync('ed25519')
          .privateKey.export({ type: 'pkcs8', format: 'pem' })
          .toString(),
      }),
      /GCS_KEY.*private_key.*RSA/,
    ],
  ]
  for (const [name, input, message] of invalidCases) {
    test(`rejects ${name} without disclosing supplied secrets`, () => {
      assert.throws(
        () => parseGcsCredentials(input),
        (error: unknown) => {
          assert.ok(error instanceof Error)
          assert.match(error.message, message)
          assert.ok(!error.message.includes('SENSITIVE_SYNTHETIC_VALUE'))
          assert.equal(error.cause, undefined)
          return true
        }
      )
    })
  }

  test('does not forward extra credential properties that can redirect authentication', () => {
    const credentials = parseGcsCredentials(
      JSON.stringify({
        ...serviceAccount,
        token_uri: 'https://untrusted.invalid/token',
        universe_domain: 'untrusted.invalid',
        credential_source: { file: '/synthetic/secret' },
      })
    )
    assert.deepEqual(credentials, serviceAccount)
  })
})
