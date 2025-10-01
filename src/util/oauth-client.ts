import * as crypto from 'node:crypto'
import * as http from 'node:http'
import * as https from 'node:https'
import {getIdApiUrl} from './domain-urls.js'

const CLIENT_ID = 'reforge-cli-public'
const CALLBACK_HOST = '127.0.0.1'
const CALLBACK_PATH = '/callback'

// Try these ports in order until we find one that's available
const FALLBACK_PORTS = [8765, 8766, 8767, 8768, 8769, 8770]

export interface OAuthTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface WorkspaceInfo {
  id: string
  name: string
  authz_jwt: string
}

export interface OrganizationInfo {
  id: string
  name: string
  roles: string[]
  workspaces: WorkspaceInfo[]
}

export interface IntrospectionResponse {
  authn_jwt: string
  organizations: OrganizationInfo[]
}

const getRedirectUri = (port: number): string => {
  return `http://${CALLBACK_HOST}:${port}${CALLBACK_PATH}`
}

// Generate PKCE code verifier and challenge
const generateCodeVerifier = (): string => {
  return crypto.randomBytes(32).toString('base64url')
}

const generateCodeChallenge = (verifier: string): string => {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

export const generateAuthUrl = (
  port: number,
  codeVerifier: string,
  domain?: string,
): string => {
  const idUrl = getIdApiUrl(domain)
  const codeChallenge = generateCodeChallenge(codeVerifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: getRedirectUri(port),
    response_type: 'code',
    scope: 'public read write',
  })

  return `${idUrl}/oauth/authorize?${params.toString()}`
}

export const createCodeVerifier = (): string => {
  return generateCodeVerifier()
}

const tryStartServer = (port: number): Promise<{port: number; server: http.Server} | null> => {
  return new Promise((resolve) => {
    const server = http.createServer()

    const onError = () => {
      server.close()
      resolve(null)
    }

    const onListening = () => {
      server.removeListener('error', onError)
      resolve({port, server})
    }

    server.once('error', onError)
    server.once('listening', onListening)

    server.listen(port, CALLBACK_HOST)
  })
}

const findAvailablePort = async (): Promise<{port: number; server: http.Server}> => {
  for (const port of FALLBACK_PORTS) {
    const result = await tryStartServer(port)
    if (result) {
      return result
    }
  }

  throw new Error(
    `Could not find an available port. Tried ports: ${FALLBACK_PORTS.join(', ')}. Please close any applications using these ports and try again.`,
  )
}

export const startCallbackServer = async (): Promise<{
  port: number
  waitForCallback: () => Promise<string>
  close: () => void
}> => {
  // First, find an available port
  const {port, server} = await findAvailablePort()

  console.log(`Listening for OAuth callback on port ${port}...`)

  const waitForCallback = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Set up request handler now that we have a port
      server.on('request', (req, res) => {
        if (req.url?.startsWith(CALLBACK_PATH)) {
          const url = new URL(req.url, `http://${req.headers.host}`)
          const code = url.searchParams.get('code')
          const error = url.searchParams.get('error')

          if (error) {
            res.writeHead(400, {'Content-Type': 'text/html'})
            res.end('<html><body><h1>Authentication failed</h1><p>You can close this window.</p></body></html>')
            reject(new Error(`OAuth error: ${error}`))
            return
          }

          if (code) {
            res.writeHead(200, {'Content-Type': 'text/html'})
            res.end(
              '<html><body><h1>Authentication successful!</h1><p>You can close this window and return to the CLI.</p></body></html>',
            )
            resolve(code)
            return
          }

          res.writeHead(400, {'Content-Type': 'text/html'})
          res.end('<html><body><h1>Invalid request</h1><p>You can close this window.</p></body></html>')
          reject(new Error('No code or error in callback'))
        } else {
          res.writeHead(404)
          res.end('Not found')
        }
      })
    })
  }

  return {
    close: () => server.close(),
    port,
    waitForCallback,
  }
}

export const exchangeCodeForTokens = async (
  code: string,
  port: number,
  codeVerifier: string,
  domain?: string,
): Promise<OAuthTokenResponse> => {
  const idUrl = getIdApiUrl(domain)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(port),
  })

  console.log('\n=== Token Exchange Request ===')
  console.log(`curl -X POST "${idUrl}/oauth/token" \\`)
  console.log(`  -H "Content-Type: application/x-www-form-urlencoded" \\`)
  console.log(`  -d "client_id=${CLIENT_ID}" \\`)
  console.log(`  -d "code=${code}" \\`)
  console.log(`  -d "code_verifier=${codeVerifier}" \\`)
  console.log(`  -d "grant_type=authorization_code" \\`)
  console.log(`  -d "redirect_uri=${getRedirectUri(port)}"`)
  console.log('==============================\n')

  // Create an agent that ignores SSL errors for local development
  const agent = process.env.IDENTITY_BASE_URL_OVERRIDE
    ? new https.Agent({rejectUnauthorized: false})
    : undefined

  const response = await fetch(`${idUrl}/oauth/token`, {
    // @ts-ignore - agent is valid for https URLs
    agent,
    body: params,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to exchange code for tokens: ${errorText}`)
  }

  const tokenData = await response.json()

  console.log('\n=== Token Exchange Response ===')
  console.log(JSON.stringify(tokenData, null, 2))
  console.log('================================\n')

  return tokenData
}

export const refreshAccessToken = async (refreshToken: string, domain?: string): Promise<OAuthTokenResponse> => {
  const idUrl = getIdApiUrl(domain)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  console.log('\n=== Refresh Token Request ===')
  console.log(`curl -X POST "${idUrl}/oauth/token" \\`)
  console.log(`  -H "Content-Type: application/x-www-form-urlencoded" \\`)
  console.log(`  -d "client_id=${CLIENT_ID}" \\`)
  console.log(`  -d "grant_type=refresh_token" \\`)
  console.log(`  -d "refresh_token=${refreshToken}"`)
  console.log('=============================\n')

  // Create an agent that ignores SSL errors for local development
  const agent = process.env.IDENTITY_BASE_URL_OVERRIDE
    ? new https.Agent({rejectUnauthorized: false})
    : undefined

  const response = await fetch(`${idUrl}/oauth/token`, {
    // @ts-ignore - agent is valid for https URLs
    agent,
    body: params,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to refresh token: ${errorText}`)
  }

  return response.json()
}

export const introspectToken = async (accessToken: string, domain?: string): Promise<IntrospectionResponse> => {
  const identityUrl = getIdApiUrl(domain)

  // Log the curl equivalent for debugging
  console.log('\n=== Identity Request ===')
  console.log(`curl -X GET "${identityUrl}/api/oauth/identity" \\`)
  console.log(`  -H "Authorization: Bearer ${accessToken}"`)
  console.log('========================\n')

  // Create an agent that ignores SSL errors for local development
  const agent = process.env.IDENTITY_BASE_URL_OVERRIDE
    ? new https.Agent({rejectUnauthorized: false})
    : undefined

  const response = await fetch(`${identityUrl}/api/oauth/identity`, {
    // @ts-ignore - agent is valid for https URLs
    agent,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    method: 'GET',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to get identity: ${errorText}`)
  }

  const data = await response.json()

  console.log('\n=== Identity Response ===')
  console.log(JSON.stringify(data, null, 2))
  console.log('=========================\n')

  return data
}

export const decodeJWT = (token: string): any => {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }
  return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
}
