import type {JsonObj, RequestResult} from '../result.js'

import {APICommand} from '../index.js'
import {Client} from '../reforge-common/src/api/client.js'
import jsonMaybe from '../util/json-maybe.js'
import {introspectToken} from '../util/oauth-client.js'
import {getActiveProfile, loadAuthConfig, loadTokens} from '../util/token-storage.js'
import version from '../version.js'

let clientInstance: Client | undefined

const getClient = async (command: APICommand, sdkKey: string, profile?: string) => {
  if (clientInstance) return clientInstance

  let jwt: string | undefined

  // If no API key provided, try to get JWT from OAuth tokens
  if (!sdkKey) {
    const authConfig = await loadAuthConfig()
    const tokens = await loadTokens()

    if (authConfig && tokens?.accessToken) {
      // Get the active profile (from flag, env var, or default)
      const activeProfile = getActiveProfile(profile)
      const profileData = authConfig.profiles[activeProfile] || authConfig.profiles[authConfig.defaultProfile || 'default']

      if (profileData) {
        // Call identity endpoint to get fresh authz JWT for the active workspace
        const introspection = await introspectToken(tokens.accessToken)
        const workspace = introspection.organizations
          .flatMap((org) => org.workspaces)
          .find((ws) => ws.id === profileData.workspace)

        if (workspace) {
          jwt = workspace.authz_jwt
        }
      }
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

  const error = jsonMaybe(await request.text())

  if (typeof error === 'string') {
    return {error: {error}, ok: false, status: request.status}
  }

  return {error, ok: false, status: request.status}
}

export default getClient
