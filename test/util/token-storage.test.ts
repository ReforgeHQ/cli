import {expect} from '@oclif/test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {afterEach, beforeEach, describe, it} from 'node:test'

import {type AuthConfig, getActiveProfile, loadAuthConfig, saveAuthConfig} from '../../src/util/token-storage.js'

describe('token-storage', () => {
  const testDir = path.join(os.tmpdir(), '.reforge-test-' + Date.now())
  const configFile = path.join(testDir, 'config')
  let originalHome: string | undefined

  beforeEach(() => {
    // Create test directory
    fs.mkdirSync(testDir, {recursive: true})

    // Mock homedir to point to our test directory
    originalHome = process.env.HOME
    process.env.HOME = testDir.replace('/.reforge-test-' + testDir.split('-').pop()!, '')
  })

  afterEach(() => {
    // Restore original HOME
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, {recursive: true})
    }

    // Clean up env vars
    delete process.env.REFORGE_PROFILE
  })

  describe('saveAuthConfig', () => {
    it('should save a single profile with comment', async () => {
      const config: AuthConfig = {
        defaultProfile: 'default',
        profiles: {
          default: {
            workspace: 'workspace-123',
            workspaceName: 'Org Name - Workspace Name',
          },
        },
      }

      await saveAuthConfig(config)

      const content = fs.readFileSync(configFile, 'utf8')
      expect(content).to.include('default_profile = default')
      expect(content).to.include('[profile default]')
      expect(content).to.include('workspace = workspace-123 # Org Name - Workspace Name')
    })

    it('should save multiple profiles', async () => {
      const config: AuthConfig = {
        defaultProfile: 'work',
        profiles: {
          default: {
            workspace: 'workspace-default',
            workspaceName: 'Default Org - Default Workspace',
          },
          work: {
            workspace: 'workspace-work',
            workspaceName: 'Work Org - Work Workspace',
          },
        },
      }

      await saveAuthConfig(config)

      const content = fs.readFileSync(configFile, 'utf8')
      expect(content).to.include('default_profile = work')
      expect(content).to.include('[profile default]')
      expect(content).to.include('[profile work]')
      expect(content).to.include('workspace = workspace-default # Default Org - Default Workspace')
      expect(content).to.include('workspace = workspace-work # Work Org - Work Workspace')
    })
  })

  describe('loadAuthConfig', () => {
    it('should load a single profile', async () => {
      const configContent = `default_profile = default

[profile default]
workspace = workspace-123 # Org Name - Workspace Name

`
      fs.writeFileSync(configFile, configContent, 'utf8')

      const config = await loadAuthConfig()

      expect(config).to.not.be.null
      expect(config!.defaultProfile).to.equal('default')
      expect(config!.profiles.default.workspace).to.equal('workspace-123')
      expect(config!.profiles.default.workspaceName).to.equal('Org Name - Workspace Name')
    })

    it('should load multiple profiles', async () => {
      const configContent = `default_profile = work

[profile default]
workspace = workspace-default # Default Org - Default Workspace

[profile work]
workspace = workspace-work # Work Org - Work Workspace

`
      fs.writeFileSync(configFile, configContent, 'utf8')

      const config = await loadAuthConfig()

      expect(config).to.not.be.null
      expect(config!.defaultProfile).to.equal('work')
      expect(config!.profiles.default.workspace).to.equal('workspace-default')
      expect(config!.profiles.work.workspace).to.equal('workspace-work')
      expect(config!.profiles.default.workspaceName).to.equal('Default Org - Default Workspace')
      expect(config!.profiles.work.workspaceName).to.equal('Work Org - Work Workspace')
    })

    it('should return null for missing file', async () => {
      const config = await loadAuthConfig()
      expect(config).to.be.null
    })
  })

  describe('getActiveProfile', () => {
    it('should return provided argument first', () => {
      process.env.REFORGE_PROFILE = 'env-profile'
      expect(getActiveProfile('arg-profile')).to.equal('arg-profile')
    })

    it('should return env var if no argument', () => {
      process.env.REFORGE_PROFILE = 'env-profile'
      expect(getActiveProfile()).to.equal('env-profile')
    })

    it('should return "default" if no argument or env var', () => {
      expect(getActiveProfile()).to.equal('default')
    })

    it('should prioritize: arg > env > default', () => {
      // No arg, no env
      expect(getActiveProfile()).to.equal('default')

      // Env set
      process.env.REFORGE_PROFILE = 'env-profile'
      expect(getActiveProfile()).to.equal('env-profile')

      // Arg overrides env
      expect(getActiveProfile('arg-profile')).to.equal('arg-profile')
    })
  })
})
