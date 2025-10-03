import {encryption} from '@reforge-com/node'

import type {APICommand} from '../index.js'
import type {Secret} from './secret-flags.js'

import {Result, failure, success} from '../result.js'

/**
 * Creates an encrypted ConfigValue using the new v1 API endpoints
 * @param command - The APICommand instance for API calls and logging
 * @param value - The plaintext value to encrypt
 * @param secret - Secret configuration containing key name
 * @param environmentId - Environment ID to fetch encryption key for (empty string for default)
 * @returns Result<ConfigValue> with encrypted value or error
 */
export async function makeConfidentialValue(
  command: APICommand,
  value: string,
  secret: Secret,
  environmentId: string,
): Promise<Result<Record<string, unknown>>> {
  // Fetch the encryption key config
  const configRequest = await command.apiClient.get(
    `/all-config-types/v1/config/${encodeURIComponent(secret.keyName)}`,
  )

  if (!configRequest.ok) {
    return failure(`Failed to fetch encryption key config ${secret.keyName}: ${configRequest.status}`, {
      phase: 'finding-secret',
    })
  }

  const keyConfig = configRequest.json as Record<string, unknown>

  // Find the encryption key for this environment (or default)
  let envVar: string | undefined

  // Check environment-specific config first
  if (keyConfig.environments && environmentId) {
    const envConfig = (keyConfig.environments as Array<Record<string, unknown>>).find(
      (env: Record<string, unknown>) => env.id === Number.parseInt(environmentId, 10),
    )
    if (envConfig?.rules?.[0]?.value?.provided?.lookup) {
      envVar = envConfig.rules[0].value.provided.lookup
    }
  }

  // Fall back to default config
  if (!envVar && keyConfig.default?.rules?.[0]?.value?.provided?.lookup) {
    envVar = keyConfig.default.rules[0].value.provided.lookup
  }

  if (!envVar) {
    return failure(
      `Failed to create secret: ${secret.keyName} not found for environment ${environmentId || 'default'} or default env`,
      {
        phase: 'finding-secret',
      },
    )
  }

  const secretKey = process.env[envVar]

  command.verboseLog(`Using env var ${envVar} to encrypt secret`)

  if (typeof secretKey !== 'string') {
    return failure(`Failed to create secret: env var ${envVar} is not present`, {
      phase: 'finding-secret',
    })
  }

  if (secretKey.length !== 64) {
    return failure(`Secret key is too short. ${secret.keyName} must be 64 characters.`, {
      phase: 'finding-secret',
    })
  }

  return success({
    confidential: true,
    decryptWith: secret.keyName,
    string: encryption.encrypt(value, secretKey),
  })
}
