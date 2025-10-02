import type {JsonObj, RequestResult} from '../result.js'

import {APICommand} from '../index.js'
import {Client} from '../reforge-common/src/api/client.js'
import jsonMaybe from '../util/json-maybe.js'
import version from '../version.js'

let clientInstance: Client | undefined

const getClient = (command: APICommand, sdkKey: string) => {
  if (clientInstance) return clientInstance

  clientInstance = new Client({
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
