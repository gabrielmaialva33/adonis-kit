import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import { PassThrough } from 'node:stream'
import { mock } from 'node:test'
import { test } from '@japa/runner'
import { ApiError, Storage } from '@google-cloud/storage'
import { Disk } from '@adonisjs/drive'
import { GCSDriver } from '@adonisjs/drive/drivers/gcs'

function forbiddenIo(): never {
  throw new Error('GCS compatibility tests must not authenticate or access the network')
}

function fixture(error?: ApiError, metadata?: Record<string, string>) {
  const storage = new Storage({
    projectId: 'synthetic-deployment-test',
    credentials: {
      client_email: 'synthetic@example.invalid',
      private_key: 'synthetic-invalid-key',
    },
  })
  // Explicit credentials prevent ADC discovery; these guards also fail closed if
  // a future SDK/adapter bypasses the synthetic request transport.
  mock.method(storage.authClient, 'getClient', forbiddenIo)
  mock.method(storage.authClient, 'getProjectId', forbiddenIo)
  mock.method(storage.authClient, 'getRequestHeaders', forbiddenIo)
  const request = mock.method(
    storage,
    'request',
    (...[_options, callback]: Parameters<Storage['request']>) => {
      assert.ok(callback, 'Expected the SDK callback request contract')
      callback(error ?? null, metadata)
    }
  )
  const disk = new Disk(
    new GCSDriver({ storage, bucket: 'synthetic-uploads', visibility: 'private' })
  )
  return { disk, request }
}

function sdkError(code: number, message: string) {
  return new ApiError({
    code,
    message,
    response: {
      statusCode: code,
      headers: {},
      body: JSON.stringify({ error: { code, message } }),
      request: Object.assign(new PassThrough(), { agent: false as const, headers: {} }),
    },
  })
}

test.group('GCS SDK compatibility', (group) => {
  group.each.setup(() => {
    mock.method(http, 'request', forbiddenIo)
    mock.method(http, 'get', forbiddenIo)
    mock.method(https, 'request', forbiddenIo)
    mock.method(https, 'get', forbiddenIo)
    mock.method(globalThis, 'fetch', forbiddenIo)
  })
  group.each.teardown(() => mock.restoreAll())

  test('maps an SDK 404 into a missing file', async () => {
    const { disk, request } = fixture(sdkError(404, 'Synthetic missing object'))
    assert.equal(await disk.exists('missing.txt'), false)
    assert.equal(request.mock.callCount(), 1)
  })

  test('preserves permission errors instead of reporting files missing', async () => {
    const { disk, request } = fixture(sdkError(403, 'Synthetic denied object'))
    await assert.rejects(
      () => disk.exists('private.txt'),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(Reflect.get(error, 'code'), 'E_CANNOT_CHECK_FILE_EXISTENCE')
        assert.ok(error.cause instanceof ApiError)
        assert.equal(error.cause.code, 403)
        return true
      }
    )
    assert.equal(request.mock.callCount(), 1)
  })

  test('maps SDK metadata into Flydrive metadata', async () => {
    const { disk, request } = fixture(undefined, {
      size: '7',
      updated: '2026-01-01T00:00:00.000Z',
      contentType: 'text/plain',
      etag: 'synthetic-etag',
    })
    const metadata = await disk.getMetaData('hello.txt')
    assert.equal(metadata.contentLength, 7)
    assert.equal(metadata.contentType, 'text/plain')
    assert.deepEqual(metadata.lastModified, new Date('2026-01-01T00:00:00.000Z'))
    assert.equal(request.mock.callCount(), 1)
  })
})
