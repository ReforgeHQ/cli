import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'

import {identityHandler} from '../test-auth-helper.js'

/**
 * Mock responses for set-default command tests
 * Uses v1 API endpoints
 */

// GET /all-config-types/v1/metadata - list all configs
const metadataHandler = http.get('https://api.staging-prefab.cloud/all-config-types/v1/metadata', () => {
  return HttpResponse.json({
    configs: [
      {
        key: 'feature-flag.simple',
        type: 'feature_flag',
        valueType: 'bool',
        version: 1,
        id: 1001,
        name: 'Simple Feature Flag',
        description: 'A simple boolean feature flag',
      },
      {
        key: 'jeffreys.test.key.reforge',
        type: 'config',
        valueType: 'string',
        version: 2,
        id: 1002,
        name: "Jeffrey's Test Config",
        description: 'A test string config',
      },
      {
        key: 'jeffreys.test.int',
        type: 'config',
        valueType: 'int',
        version: 1,
        id: 1003,
        name: "Jeffrey's Int Config",
        description: 'A test int config',
      },
      {
        key: 'robocop-secret',
        type: 'config',
        valueType: 'string',
        version: 1,
        id: 1004,
        name: 'Robocop Secret',
        description: 'A secret config',
      },
      {
        key: 'test.json',
        type: 'config',
        valueType: 'json',
        version: 1,
        id: 1005,
        name: 'Test JSON',
        description: 'A JSON config',
      },
      {
        key: 'reforge.secrets.encryption.key',
        type: 'config',
        valueType: 'string',
        version: 1,
        id: 1006,
        name: 'Encryption Key',
        description: 'Encryption key for secrets',
      },
    ],
  })
})

// GET /environments/v1 - list environments
const environmentsHandler = http.get('https://api.staging-prefab.cloud/environments/v1', () => {
  return HttpResponse.json({
    environments: [
      {id: '5', name: 'Development', active: true, protected: false},
      {id: '6', name: 'Staging', active: true, protected: false},
      {id: '7', name: 'Production', active: true, protected: true},
    ],
  })
})

// GET /all-config-types/v1/config/:key - get encryption key config
const encryptionKeyHandler = http.get(
  'https://api.staging-prefab.cloud/all-config-types/v1/config/reforge.secrets.encryption.key',
  () => {
    return HttpResponse.json({
      key: 'reforge.secrets.encryption.key',
      type: 'config',
      valueType: 'string',
      default: {
        rules: [
          {
            criteria: [],
            value: {
              provided: {
                source: 'ENV_VAR',
                lookup: 'REFORGE_INTEGRATION_TEST_ENCRYPTION_KEY',
              },
            },
          },
        ],
      },
      environments: [
        {
          id: 6,
          rules: [
            {
              criteria: [],
              value: {
                provided: {
                  source: 'ENV_VAR',
                  lookup: 'REFORGE_INTEGRATION_TEST_ENCRYPTION_KEY',
                },
              },
            },
          ],
        },
      ],
    })
  },
)

// GET /all-config-types/v1/config/robocop-secret - get robocop secret (has encrypted values)
const robocopSecretHandler = http.get(
  'https://api.staging-prefab.cloud/all-config-types/v1/config/robocop-secret',
  () => {
    return HttpResponse.json({
      key: 'robocop-secret',
      type: 'config',
      valueType: 'string',
      default: {
        rules: [
          {
            criteria: [],
            value: {
              type: 'string',
              value: 'encrypted-value-here',
              confidential: true,
              decryptWith: 'reforge.secrets.encryption.key',
            },
          },
        ],
      },
    })
  },
)

// POST /internal/ops/v1/set-default - set default value
const setDefaultHandler = http.post('https://api.staging-prefab.cloud/internal/ops/v1/set-default', async ({request}) => {
  const body = (await request.json()) as any

  // Validate the request (allow environmentId: 0 for default environment)
  if (!body.configKey || body.currentVersionId === undefined) {
    return HttpResponse.json({error: 'Missing required fields'}, {status: 400})
  }

  // Check for invalid boolean values
  if (body.configKey === 'feature-flag.simple') {
    if (body.value?.string) {
      // String value for boolean flag is invalid
      return HttpResponse.json(
        {error: `'${body.value.string}' is not a valid value for feature-flag.simple`},
        {status: 400},
      )
    }
  }

  // Check for invalid int values
  if (body.configKey === 'jeffreys.test.int') {
    if (body.value?.int === undefined && body.value?.string !== undefined) {
      // Non-integer value for int config
      return HttpResponse.json({error: `Invalid default value for int: ${body.value.string}`}, {status: 400})
    }
  }

  // Success response
  return HttpResponse.json({
    success: true,
    newVersionId: body.currentVersionId + 1,
  })
})

export const server = setupServer(
  identityHandler,
  metadataHandler,
  environmentsHandler,
  encryptionKeyHandler,
  robocopSecretHandler,
  setDefaultHandler,
)
