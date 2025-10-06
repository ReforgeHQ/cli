import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {http, HttpResponse} from 'msw'

/**
 * Mock identity service response for tests
 */
export const mockIdentityResponse = {
  authn_jwt: 'mock-authn-jwt',
  organizations: [
    {
      id: 'org-123',
      name: 'Test Organization',
      roles: ['admin'],
      workspaces: [
        {
          authz_jwt: 'mock-authz-jwt-workspace-123',
          id: 'workspace-123',
          name: 'Test Workspace',
        },
      ],
    },
  ],
}

/**
 * MSW handlers for identity endpoint
 * Supports both default reforge.com and test goatsofreforge.com domains
 */
export const identityHandler = http.get('https://id.reforge.com/api/oauth/identity', () => {
  return HttpResponse.json(mockIdentityResponse)
})

export const identityHandlerTestDomain = http.get('https://id.goatsofreforge.com/api/oauth/identity', () => {
  return HttpResponse.json(mockIdentityResponse)
})

/**
 * Setup authentication files for tests
 * Creates actual token and config files in ~/.reforge/
 */
export const setupTestAuth = () => {
  const reforgeDir = path.join(os.homedir(), '.reforge')
  const tokensFile = path.join(reforgeDir, 'tokens.json')
  const configFile = path.join(reforgeDir, 'config')

  // Ensure directory exists
  fs.mkdirSync(reforgeDir, {recursive: true})

  // Write tokens file
  const mockTokens = {
    accessToken: 'mock-access-token',
    expiresAt: Date.now() + 3600000, // 1 hour from now
    refreshToken: 'mock-refresh-token',
  }
  fs.writeFileSync(tokensFile, JSON.stringify(mockTokens, null, 2))

  // Write config file
  const configContent = `default_profile = default

[profile default]
workspace = workspace-123 # Test Organization - Test Workspace

`
  fs.writeFileSync(configFile, configContent)

  // Set test domain
  process.env.REFORGE_DOMAIN = 'goatsofreforge.com'

  // Set test encryption key (64 character hex string)
  process.env.REFORGE_INTEGRATION_TEST_ENCRYPTION_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

  return {tokensFile, configFile}
}

/**
 * Cleanup authentication files after tests
 */
export const cleanupTestAuth = () => {
  const reforgeDir = path.join(os.homedir(), '.reforge')
  const tokensFile = path.join(reforgeDir, 'tokens.json')
  const configFile = path.join(reforgeDir, 'config')

  try {
    if (fs.existsSync(tokensFile)) fs.unlinkSync(tokensFile)
    if (fs.existsSync(configFile)) fs.unlinkSync(configFile)
    delete process.env.REFORGE_DOMAIN
    delete process.env.REFORGE_INTEGRATION_TEST_ENCRYPTION_KEY
  } catch {
    // Ignore cleanup errors
  }
}
