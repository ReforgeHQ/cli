import {HttpResponse, http} from 'msw'
import {setupServer} from 'msw/node'

import {identityHandler, identityHandlerTestDomain} from '../test-auth-helper.js'

/**
 * Mock responses for get command tests
 * Uses v1 API endpoints
 */

// GET /all-config-types/v1/metadata - list all configs
const metadataHandler = http.get('https://api.goatsofreforge.com/all-config-types/v1/metadata', () => HttpResponse.json({
    configs: [
      {
        key: 'my-string-list-key',
        type: 'config',
        valueType: 'string_list',
        version: 1,
        id: 1,
        name: 'My String List',
        description: 'A string list config',
      },
      {
        key: 'a.secret.config.reforge',
        type: 'config',
        valueType: 'string',
        version: 1,
        id: 2,
        name: 'Secret Config',
        description: 'A secret config',
      },
    ],
  }))

// GET /environments/v1 - list environments
const environmentsHandler = http.get('https://api.goatsofreforge.com/environments/v1', () => HttpResponse.json({
    environments: [{id: '', name: '[default]', active: true, protected: false}],
  }))

// GET /evaluation/v1/eval - evaluate a config
const evaluationHandler = http.get('https://api.goatsofreforge.com/evaluation/v1/eval', ({request}) => {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')

  if (key === 'my-string-list-key') {
    return HttpResponse.json({
      evaluations: {
        'my-string-list-key': {
          metadata: {
            conditionalValueIndex: 0,
            configRowIndex: 0,
            id: 1,
            type: 'config',
            valueType: 'string_list',
          },
          type: 'string_list',
          value: ['a', 'b', 'c'],
        },
      },
    })
  }

  if (key === 'a.secret.config.reforge') {
    return HttpResponse.json({
      evaluations: {
        'a.secret.config.reforge': {
          metadata: {
            conditionalValueIndex: 0,
            configRowIndex: 0,
            id: 2,
            type: 'config',
            valueType: 'string',
          },
          type: 'string',
          value: 'hello.world',
        },
      },
    })
  }

  return HttpResponse.json({error: 'Config not found'}, {status: 404})
})

export const server = setupServer(
  identityHandler,
  identityHandlerTestDomain,
  metadataHandler,
  environmentsHandler,
  evaluationHandler,
)
