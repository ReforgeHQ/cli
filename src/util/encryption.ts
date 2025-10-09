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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Result<any>> {
  // First check if the encryption key exists in metadata
  const metadataRequest = await command.apiClient.get('/all-config-types/v1/metadata')

  if (!metadataRequest.ok) {
    return failure(`Failed to check if encryption key exists: ${metadataRequest.status}`, {
      phase: 'finding-secret',
    })
  }

  interface ConfigMetadata {
    [key: string]: unknown
    key: string
  }

  interface MetadataResponse {
    configs: ConfigMetadata[]
  }

  const metadata = metadataRequest.json as unknown as MetadataResponse
  const keyExists = metadata.configs.some((config) => config.key === secret.keyName)

  if (!keyExists) {
    return failure(
      `Failed to create secret: encryption key '${secret.keyName}' does not exist. Please create it first or use --secret-key-name to specify a different key.`,
      {
        phase: 'finding-secret',
      },
    )
  }

  // Fetch the encryption key config
  const configRequest = await command.apiClient.get(`/all-config-types/v1/config/${encodeURIComponent(secret.keyName)}`)

  if (!configRequest.ok) {
    const message =
      configRequest.status === 404
        ? `Failed to create secret: ${secret.keyName} not found`
        : `Failed to fetch encryption key config ${secret.keyName}: ${configRequest.status}`
    return failure(message, {
      phase: 'finding-secret',
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keyConfig = configRequest.json as any

  // Find the encryption key for this environment (or default)
  let secretKey: string | undefined
  let envVar: string | undefined

  // Check environment-specific config first
  if (keyConfig.environments && environmentId) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const envConfig = (keyConfig.environments as any[]).find(
      (env: any) => env.id === Number.parseInt(environmentId, 10),
    )
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const ruleValue = envConfig?.rules?.[0]?.value

    // Check if it's a provided value (env var)
    if (ruleValue?.type === 'provided' && ruleValue?.value?.lookup) {
      envVar = ruleValue.value.lookup
    }
    // Check for old format: provided.lookup
    else if (ruleValue?.provided?.lookup) {
      envVar = ruleValue.provided.lookup
    }
    // Otherwise it's a literal value
    else if (ruleValue?.value && typeof ruleValue.value === 'string') {
      secretKey = ruleValue.value
    }
  }

  // Fall back to default config
  if (!secretKey && !envVar) {
    const defaultValue = keyConfig.default?.rules?.[0]?.value

    // Check if it's a provided value (env var)
    if (defaultValue?.type === 'provided' && defaultValue?.value?.lookup) {
      envVar = defaultValue.value.lookup
    }
    // Check for old format: provided.lookup
    else if (defaultValue?.provided?.lookup) {
      envVar = defaultValue.provided.lookup
    }
    // Otherwise it's a literal value
    else if (defaultValue?.value && typeof defaultValue.value === 'string') {
      secretKey = defaultValue.value
    }
  }

  // If we have an env var, resolve it
  if (envVar && !secretKey) {
    secretKey = process.env[envVar]
    command.verboseLog(`Using env var ${envVar} to encrypt secret`)

    if (typeof secretKey !== 'string') {
      return failure(`Failed to create secret: env var ${envVar} is not present`, {
        phase: 'finding-secret',
      })
    }
  }

  // If we have a literal value, use it
  if (secretKey) {
    command.verboseLog(`Using literal value from ${secret.keyName} to encrypt secret`)
  }

  if (!secretKey) {
    return failure(
      `Failed to create secret: ${secret.keyName} does not have a value configured for environment ${environmentId || 'default'} or default env`,
      {
        phase: 'finding-secret',
      },
    )
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
