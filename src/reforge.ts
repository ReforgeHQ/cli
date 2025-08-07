import {Reforge} from '@reforge-com/node'

import type {ConfigValue} from './reforge-common/src/types.js'

import {CommandLike} from './ui/get-key.js'

type Flags = {
  ['api-key']?: string
}

type FlagsOrDatafile = Flags | string

let reforge: Reforge

const DEFAULT_CONTEXT_USER_ID_NAMESPACE = 'prefab-api-key'
const DEFAULT_CONTEXT_USER_ID = 'user-id'

export const initReforge = async (_ctx: CommandLike, flagsOrDatafile: FlagsOrDatafile) => {
  let apiKey = 'NO_API_KEY'
  let datafile

  if (typeof flagsOrDatafile === 'string') {
    datafile = flagsOrDatafile
  } else {
    if (!flagsOrDatafile['api-key']) {
      throw new Error(`API key is required`)
    }

    apiKey = flagsOrDatafile['api-key']
  }

  const options: ConstructorParameters<typeof Reforge>[0] = {
    apiKey,
    collectEvaluationSummaries: false,
    collectLoggerCounts: false,
    contextUploadMode: 'none',
    datafile,
    enableSSE: false,
  }

  options.sources = process.env.REFORGE_API_URL ? [process.env.REFORGE_API_URL] : ['https://api.prefab.cloud']

  reforge = new Reforge(options)

  await reforge.init()

  return reforge
}

const getUserId = (): string =>
  reforge.defaultContext()?.get(DEFAULT_CONTEXT_USER_ID_NAMESPACE)?.get(DEFAULT_CONTEXT_USER_ID) as string

const getRowInEnvironment = ({desiredEnvId, key}: {desiredEnvId: string; key: string}) => {
  const envId = desiredEnvId

  const config = reforge.raw(key)

  if (!config) {
    return
  }

  return config.rows.find((row) => row.projectEnvId?.toString() === envId)
}

export const overrideFor = ({
  currentEnvironmentId,
  key,
}: {
  currentEnvironmentId: string
  key: string
}): ConfigValue | undefined => {
  const userId = getUserId()

  const row = getRowInEnvironment({desiredEnvId: currentEnvironmentId, key})

  if (row) {
    for (const value of row.values) {
      for (const criterion of value.criteria) {
        if (
          criterion.propertyName === `${DEFAULT_CONTEXT_USER_ID_NAMESPACE}.${DEFAULT_CONTEXT_USER_ID}` &&
          criterion.valueToMatch?.stringList?.values.includes(userId)
        ) {
          return value.value
        }
      }
    }
  }

  return undefined
}

export const defaultValueFor = (envId: string, key: string): ConfigValue | undefined => {
  const row = getRowInEnvironment({desiredEnvId: envId, key})

  return row?.values.at(-1)?.value
}
