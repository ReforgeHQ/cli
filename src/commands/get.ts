import {Flags} from '@oclif/core'

import {APICommand} from '../index.js'
import {JsonObj} from '../result.js'
import getEnvironment from '../ui/get-environment.js'
import getString from '../ui/get-string.js'
import isInteractive from '../util/is-interactive.js'
import nameArg from '../util/name-arg.js'

interface EvaluationMetadata {
  conditionalValueIndex: number
  configRowIndex: number
  id: number
  type: string
  valueType: string
}

interface Evaluation {
  metadata: EvaluationMetadata
  type: string
  value: string
}

interface EvaluationResponse {
  evaluations: Record<string, Evaluation>
}

export default class Get extends APICommand {
  static args = {...nameArg}

  static description = 'Get the value of a config/feature-flag/etc.'

  static examples = [
    '<%= config.bin %> <%= command.id %> my.config.name',
    '<%= config.bin %> <%= command.id %> my.config.name --environment=production',
  ]

  static flags = {
    environment: Flags.string({description: 'environment to evaluate in'}),
  }

  public async run(): Promise<JsonObj | void> {
    const {args, flags} = await this.parse(Get)

    let key = args.name

    if (!key && isInteractive(flags)) {
      key = await getString({
        allowBlank: false,
        message: 'Config key',
      })
    }

    if (!key) {
      return this.err('Key is required')
    }

    // Get the environment
    const environment = await getEnvironment({
      command: this,
      flags,
      message: 'Which environment would you like to evaluate in?',
      providedEnvironment: flags.environment,
    })

    if (!environment) {
      return
    }

    // First, check if the key exists
    const metadataRequest = await this.apiClient.get('/all-config-types/v1/metadata')

    if (!metadataRequest.ok) {
      const errorMsg = metadataRequest.error?.error || `Failed to fetch configs: ${metadataRequest.status}`
      return this.err(errorMsg, {serverError: metadataRequest.error})
    }

    interface ConfigMetadata {
      description: string
      id: number
      key: string
      name: string
      type: string
      version: number
    }

    interface ConfigMetadataResponse {
      configs: ConfigMetadata[]
    }

    const metadataResponse = metadataRequest.json as unknown as ConfigMetadataResponse
    const configExists = metadataResponse.configs.some((config) => config.key === key)

    if (!configExists) {
      return this.err(`${key} does not exist`)
    }

    const request = await this.apiClient.get(
      `/evaluation/v1/eval?key=${encodeURIComponent(key)}&envId=${encodeURIComponent(environment.id)}`,
    )

    if (!request.ok) {
      const errorMsg = request.error?.error || `Failed to get config: ${request.status}`
      return this.err(errorMsg, {serverError: request.error})
    }

    const response = request.json as unknown as EvaluationResponse
    const evaluation = response.evaluations[key]
    const value = evaluation.value

    return this.ok(this.toSuccessJson(value), {[key]: value})
  }
}
