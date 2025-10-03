import type {JsonObj, RequestResult} from '../result.js'

import {APICommand} from '../index.js'
import {Client} from '../reforge-common/src/api/client.js'
import jsonMaybe from '../util/json-maybe.js'
import {introspectToken} from '../util/oauth-client.js'
import {getActiveProfile, loadAuthConfig, loadTokens} from '../util/token-storage.js'
import version from '../version.js'

let clientInstance: Client | undefined

const getClient = async (command: APICommand, sdkKey?: string, profile?: string) => {
  if (clientInstance) return clientInstance

  let jwt: string | undefined

  // If no API key provided, try to get JWT from OAuth tokens
  if (!sdkKey) {
    const authConfig = await loadAuthConfig()
    const tokens = await loadTokens()

    command.verboseLog('OAuth auth', {
      hasAuthConfig: Boolean(authConfig),
      hasAccessToken: Boolean(tokens?.accessToken),
    })

    if (authConfig && tokens?.accessToken) {
      // Get the active profile (from flag, env var, or default)
      const activeProfile = getActiveProfile(profile)
      const profileData = authConfig.profiles[activeProfile] || authConfig.profiles[authConfig.defaultProfile || 'default']

      command.verboseLog('Profile lookup', {
        activeProfile,
        hasProfileData: Boolean(profileData),
        workspaceId: profileData?.workspace,
      })

      if (profileData) {
        // Call identity endpoint to get fresh authz JWT for the active workspace
        const introspection = await introspectToken(tokens.accessToken)
        const workspace = introspection.organizations
          .flatMap((org) => org.workspaces)
          .find((ws) => ws.id === profileData.workspace)

        command.verboseLog('JWT lookup', {
          foundWorkspace: Boolean(workspace),
          hasAuthzJwt: Boolean(workspace?.authz_jwt),
        })

        if (workspace) {
          jwt = workspace.authz_jwt
        }
      }
    }

    // If still no JWT, user needs to login
    if (!jwt) {
      command.error('No authentication found. Please run `reforge login`.', {exit: 401})
    }
  }

  clientInstance = new Client({
    jwt,
    sdkKey,
    apiUrl: process.env.REFORGE_API_URL,
    clientIdentifier: `cli-${version}`,
    log: command.verboseLog,
  })

  return clientInstance
}

export const unwrapRequest = async (command: APICommand, promise: Promise<Response>): Promise<RequestResult> => {
  const request = await promise

  if (request.status.toString().startsWith('2')) {
    const json = (await request.json()) as JsonObj
    command.verboseLog('ApiClient', {response: json})

    return {json, ok: true, status: request.status}
  }

  // Handle 403 with a user-friendly message
  if (request.status === 403) {
    return {
      error: {error: 'You do not have permission to perform this action. Please check your workspace permissions.'},
      ok: false,
      status: request.status,
    }
  }

  const error = jsonMaybe(await request.text())

  if (typeof error === 'string') {
    return {error: {error}, ok: false, status: request.status}
  }

  return {error, ok: false, status: request.status}
}

export default getClient
