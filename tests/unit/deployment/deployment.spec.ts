import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, posix, relative } from 'node:path'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { parse } from 'yaml'
import { satisfies, subset } from 'semver'
import type { Ignore } from '@balena/dockerignore'
import { fileURLToPath } from 'node:url'
import driveConfig from '#config/drive'

const root = new URL('../../../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
const manifest = JSON.parse(read('package.json'))
const compose = parse(read('docker-compose.yml'))
const dockerfile = read('Dockerfile')
const workdir = dockerfile.match(/^WORKDIR\s+(\S+)/m)![1]
const require = createRequire(import.meta.url)
const dockerignore: () => Ignore = require('@balena/dockerignore')

test.group('Deployment contracts', () => {
  test('declares a usable default storage driver in the environment example', () => {
    assert.match(read('.env.example'), /^DRIVE_DISK=fs$/m)
  })

  test('persists the configured private filesystem disk without publishing an upload route', async () => {
    const resolved = await driveConfig.resolver(app)
    const disk = resolved.config.services.fs()
    // Translate the actual app-relative disk directory to the container workdir.
    const diskLocation =
      disk.options.location instanceof URL
        ? fileURLToPath(disk.options.location)
        : disk.options.location
    const diskPath = relative(app.makePath(), diskLocation)
    assert.ok(diskPath && !diskPath.startsWith('..'))
    const location = posix.join(workdir, diskPath)
    const mounts = (compose.services.app.volumes ?? []).map((mount: string) => {
      const [source, target, mode] = mount.split(':')
      return { source, target, mode }
    })
    const persistent = mounts.find((mount: { target: string }) => mount.target === location)
    assert.ok(persistent, `No persistent mount for configured disk ${location}`)
    assert.ok(Object.hasOwn(compose.volumes, persistent.source))
    assert.notEqual(persistent.mode, 'ro')
    assert.equal(disk.options.visibility, 'private')
    assert.deepEqual(resolved.locallyServed, [])
  })

  test('forwards the client password-reset destination to the container', () => {
    assert.equal(compose.services.app.environment.PASSWORD_RESET_URL, '${PASSWORD_RESET_URL:-}')
  })

  test('pins local, container and CI runtimes to the same supported Node 24 release', () => {
    const localVersion = read('.nvmrc').trim().replace(/^v/, '')
    const imageVersion = dockerfile.match(/^ARG NODE_VERSION=(\S+)/m)![1]
    const ci = parse(read('.github/workflows/ci-cd.yml'))
    const setupSteps = Object.values(ci.jobs)
      .flatMap((job: any) => job.steps ?? [])
      .filter((step: any) => step.uses?.startsWith('actions/setup-node@'))
    assert.ok(setupSteps.length > 0)
    const ciVersions = setupSteps.map(
      (step: any) =>
        step.with['node-version'] ?? read(step.with['node-version-file']).trim().replace(/^v/, '')
    )
    for (const version of [localVersion, imageVersion, ...ciVersions]) {
      assert.ok(satisfies(version, '>=24.15.0 <25'), `${version} lacks required runtime APIs`)
      assert.ok(satisfies(version, manifest.engines.node))
      assert.equal(version, localVersion)
    }
    const pnpm = dockerfile.match(/corepack prepare pnpm@(\S+) --activate/)![1]
    assert.equal(manifest.packageManager, `pnpm@${pnpm}`)
    assert.ok(satisfies(pnpm, manifest.engines.pnpm))
  })

  test('runs the API gates on main with frozen dependency installs', () => {
    const ci = parse(read('.github/workflows/ci-cd.yml'))
    assert.ok(ci.on.push.branches.includes('main'))
    assert.ok(ci.on.pull_request.branches.includes('main'))
    const steps = ci.jobs.ci.steps
    const commands = steps.map((step: any) => step.run).filter(Boolean)
    for (const command of [
      'pnpm install --frozen-lockfile',
      'pnpm lint',
      'pnpm typecheck',
      'pnpm test:e2e',
      'pnpm build',
    ]) {
      assert.ok(commands.includes(command), `Missing CI gate: ${command}`)
    }
    const pnpmSetup = steps.find((step: any) => step.uses?.startsWith('pnpm/action-setup@'))
    assert.ok(pnpmSetup)
    assert.equal(pnpmSetup.with?.version, undefined, 'Read pnpm version from packageManager')
    assert.doesNotMatch(commands.join('\n'), /vitest|test:ui|playwright/)
    assert.doesNotMatch(dockerfile, /inertia|vite|SSR|public\/assets/)
  })

  test('keeps browser application and test runtimes out of the locked dependency graph', () => {
    const lock = parse(read('pnpm-lock.yaml'))
    const browserPackages = [
      '@adonisjs/inertia',
      '@adonisjs/vite',
      '@inertiajs/core',
      '@inertiajs/react',
      'react',
      'react-dom',
      'vite',
      'vitest',
      'playwright',
      'playwright-core',
      '@japa/browser-client',
      'msw',
    ]
    // Check resolved packages, not only direct dependencies: optional peers can
    // silently reintroduce the entire UI stack into a production installation.
    const unexpected = Object.keys(lock.packages).filter((entry) =>
      browserPackages.some((name) => entry.startsWith(`${name}@`))
    )
    assert.deepEqual(
      unexpected,
      [],
      `Browser packages remain in the lockfile: ${unexpected.join(', ')}`
    )
  })

  test('includes custom Ace commands in the production TypeScript compilation', () => {
    const tsconfig = JSON.parse(read('tsconfig.json'))
    assert.ok(
      tsconfig.include.includes('commands/**/*.ts'),
      'Custom Ace commands would be absent from the production build'
    )
  })

  test('selects GCS versions accepted by the actual Flydrive adapter', () => {
    const driveRequire = createRequire(require.resolve('@adonisjs/drive'))
    const flydriveEntry = driveRequire.resolve('flydrive')
    const flydrive = JSON.parse(
      readFileSync(join(dirname(flydriveEntry), '../package.json'), 'utf8')
    )
    const storage = JSON.parse(read('node_modules/@google-cloud/storage/package.json'))
    const supported = flydrive.peerDependencies['@google-cloud/storage']
    assert.ok(subset(manifest.dependencies['@google-cloud/storage'], supported))
    assert.ok(satisfies(storage.version, supported))
  })

  for (const path of [
    '.env',
    '.env.test',
    '.env.production',
    '.env.local',
    '.env.backup',
    'nested/.env',
    'nested/.env.production',
  ]) {
    test(`excludes ${path} from the Docker build context`, () => {
      assert.equal(dockerignore().add(read('.dockerignore')).ignores(path), true)
    })
  }

  test('excludes private uploads from the Docker image', () => {
    assert.equal(
      dockerignore().add(read('.dockerignore')).ignores('storage/tenant/private.pdf'),
      true
    )
  })

  test('keeps non-secret environment templates and application sources in the build context', () => {
    const ignore = dockerignore().add(read('.dockerignore'))
    assert.equal(ignore.ignores('.env.example'), false)
    assert.equal(ignore.ignores('app/modules/files/services/file_service.ts'), false)
  })
})
