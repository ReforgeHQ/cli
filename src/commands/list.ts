import {Flags} from '@oclif/core'
import {ConfigType} from '@reforge-com/node'

import {APICommand} from '../index.js'

interface ConfigMetadata {
  id: number
  type: string
  key: string
  name: string
  description: string
  version: number
}

interface ConfigMetadataResponse {
  configs: ConfigMetadata[]
}

export default class List extends APICommand {
  static description = `Show keys for your config/feature flags/etc.

  All types are returned by default. If you pass one or more type flags (e.g. --configs), only those types will be returned`

  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --feature-flags']

  static flags = {
    configs: Flags.boolean({default: false, description: 'include configs'}),
    'feature-flags': Flags.boolean({default: false, description: 'include flags'}),
    'log-levels': Flags.boolean({default: false, description: 'include log levels'}),
    schemas: Flags.boolean({default: false, description: 'include schemas'}),
    segments: Flags.boolean({default: false, description: 'include segments'}),
  }

  public async run() {
    const {flags} = await this.parse(List)

    const request = await this.apiClient.get('/all-config-types/v1/metadata')

    if (!request.ok) {
      return this.err(`Failed to fetch configs: ${request.status}`, {serverError: request.error})
    }

    const response = request.json as unknown as ConfigMetadataResponse
    let configs = response.configs

    const selectedTypes: string[] = []

    if (flags.configs) {
      selectedTypes.push('config')
    }

    if (flags['feature-flags']) {
      selectedTypes.push('feature_flag')
    }

    if (flags['log-levels']) {
      selectedTypes.push('log_level')
    }

    if (flags.schemas) {
      selectedTypes.push('schema')
    }

    if (flags.segments) {
      selectedTypes.push('segment')
    }

    if (selectedTypes.length > 0) {
      configs = configs.filter((config) => selectedTypes.includes(config.type.toLowerCase()))
    }

    const keys = configs.map((config) => config.key)

    return this.ok(keys.join('\n'), {keys})
  }
}
