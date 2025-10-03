import {Flags} from '@oclif/core'

import {type Environment, getEnvironments} from '../api/get-environments.js'
import {APICommand} from '../index.js'
import {JsonObj} from '../result.js'
import autocomplete from '../util/autocomplete.js'
import isInteractive from '../util/is-interactive.js'
import nameArg from '../util/name-arg.js'

export default class Info extends APICommand {
  static args = {...nameArg}

  static description = 'Show details about the provided config/feature-flag/etc.'

  static examples = ['<%= config.bin %> <%= command.id %> my.config.name']

  static flags = {
    'exclude-evaluations': Flags.boolean({default: false, description: 'Exclude evaluation data'}),
  }

  public async run(): Promise<JsonObj | void> {
    const {args, flags} = await this.parse(Info)

    // Fetch all configs from metadata endpoint
    const metadataRequest = await this.apiClient.get('/all-config-types/v1/metadata')

    if (!metadataRequest.ok) {
      const errorMsg = metadataRequest.error?.error || `Failed to fetch configs: ${metadataRequest.status}`
      return this.err(errorMsg, {serverError: metadataRequest.error})
    }

    interface ConfigMetadata {
      key: string
    }

    interface ConfigMetadataResponse {
      configs: ConfigMetadata[]
    }

    const metadataResponse = metadataRequest.json as unknown as ConfigMetadataResponse
    const configs = metadataResponse.configs

    // Get the key - from args or prompt
    let key = args.name

    if (!key && isInteractive(flags)) {
      const configKeys = configs.map((c) => c.key)
      const selectedKey = await autocomplete({
        message: 'Which item would you like to see?',
        source: configKeys,
      })
      if (selectedKey) {
        key = selectedKey
      }
    }

    if (!key) {
      return this.err('Key is required')
    }

    // Fetch full config details
    const configRequest = await this.apiClient.get(`/all-config-types/v1/config/${encodeURIComponent(key)}`)

    if (!configRequest.ok) {
      const errorMsg = configRequest.error?.error || `Failed to fetch config: ${configRequest.status}`
      return this.err(errorMsg, {serverError: configRequest.error})
    }

    const fullConfig = configRequest.json

    this.verboseLog('Full config:', fullConfig)

    // Get environments
    const environments = await getEnvironments(this)

    const url = `${process.env.REFORGE_API_URL || 'https://app.prefab.cloud'}/config/${key}`

    this.log(url)
    this.log('')

    const json: JsonObj = {url}

    json.values = this.parseConfig(fullConfig, environments, url)
    this.log('')

    // Fetch evaluation stats if needed
    if (!flags['exclude-evaluations']) {
      const evalStats = await this.fetchEvaluationStats(key, flags, environments)
      if (evalStats) {
        json.evaluations = evalStats
      }
    }

    return {[key]: json}
  }

  private displayEvaluationStats(statsPerEnv: JsonObj, environments: Environment[]): void {
    this.log('Evaluations over the last 24 hours:\n')

    const contents: string[] = []

    for (const env of environments) {
      const envStats = statsPerEnv[env.name] as Record<string, unknown>
      if (!envStats || !Array.isArray(envStats.intervals)) continue

      let totalEvaluations = 0
      const valueBreakdown: Map<string, number> = new Map()

      // Aggregate data across all intervals for this environment
      for (const interval of envStats.intervals) {
        if (interval.data) {
          for (const dataPoint of interval.data) {
            totalEvaluations += dataPoint.count || 0

            let valueKey = 'unknown'
            if (dataPoint.selectedValue) {
              valueKey = this.extractSimpleValue(dataPoint.selectedValue)
            }

            valueBreakdown.set(valueKey, (valueBreakdown.get(valueKey) || 0) + (dataPoint.count || 0))
          }
        }
      }

      if (totalEvaluations > 0) {
        contents.push(`${env.name}: ${totalEvaluations.toLocaleString()}`)

        const sortedValues = [...valueBreakdown.entries()].sort((a, b) => b[1] - a[1])

        for (const [value, count] of sortedValues) {
          const percentage = Math.round((count / totalEvaluations) * 100)
          contents.push(`- ${percentage}% - ${value}`)
        }

        contents.push('')
      }
    }

    if (contents.length > 0) {
      this.log(contents.join('\n').trim())
      this.log('')
    } else {
      this.log('No evaluations found for the past 24 hours')
      this.log('')
    }
  }

  private extractSimpleValue(value: Record<string, unknown>): string {
    if (!value) return 'null'

    if (value.type && value.value !== undefined) {
      // Format the value based on type
      if (value.type === 'string') {
        return `"${value.value}"`
      }
      if (value.type === 'json') {
        return JSON.stringify(value.value)
      }
      if (value.type === 'stringList') {
        return JSON.stringify(value.value)
      }
      return String(value.value)
    }

    return JSON.stringify(value)
  }

  private async fetchEvaluationStats(
    key: string,
    flags: Record<string, unknown>,
    environments: Environment[],
  ): Promise<JsonObj | undefined> {
    // Fetch stats for all environments (similar to original implementation)
    const endTime = Date.now()
    const startTime = endTime - 24 * 60 * 60 * 1000 // 24 hours ago
    const timeInterval = 'HOURLY'

    const statsPerEnv: JsonObj = {}

    // Fetch stats for each environment
    for (const env of environments) {
      const queryParams = new URLSearchParams({
        projectEnvId: env.id,
        key,
        timeInterval,
        startTime: String(startTime),
        endTime: String(endTime),
      })

      // eslint-disable-next-line no-await-in-loop
      const request = await this.apiClient.get(`/evaluation-statistics/v1?${queryParams.toString()}`)

      if (request.ok) {
        const response = request.json as Record<string, unknown>
        statsPerEnv[env.name] = response
      }
    }

    if (Object.keys(statsPerEnv).length === 0) {
      this.log('No evaluations found for the past 24 hours')
      return {error: 'No evaluations found for the past 24 hours'}
    }

    this.displayEvaluationStats(statsPerEnv, environments)

    return statsPerEnv
  }

  private formatValue(value: Record<string, unknown>): string {
    if (!value) return 'null'

    // Handle weighted values (A/B testing)
    if (Array.isArray(value.weightedValues)) {
      const weights = value.weightedValues
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          (b.weight as number) - (a.weight as number))
        .map((wv: Record<string, unknown>) => {
          const percent = (((wv.weight as number) / 1000) * 100).toFixed(1)
          const val = this.extractSimpleValue(wv.value as Record<string, unknown>)
          return `${percent}% ${val}`
        })
      return weights.join(', ')
    }

    // Handle provided values (ENV_VAR)
    if (value.provided) {
      let str = `${value.provided.lookup}`
      if (value.confidential) {
        str = `\`${str}\``
      }
      str += ' via ENV'
      return str
    }

    // Handle simple values
    return this.extractSimpleValue(value)
  }

  private parseConfig(config: Record<string, unknown>, environments: Environment[], url: string) {
    const contents: string[] = []
    const json: JsonObj = {}

    // Collect all environment configs including default
    const allEnvConfigs = []

    // Add default config as a special environment
    if (config.default) {
      allEnvConfigs.push({
        id: null,
        name: 'Default',
        rules: config.default.rules,
      })
    }

    // Add environment-specific configs
    if (config.environments) {
      for (const envConfig of config.environments) {
        const env = environments.find((e) => e.id === envConfig.id)
        allEnvConfigs.push({
          id: envConfig.id,
          name: env?.name || envConfig.id,
          rules: envConfig.rules,
        })
      }
    }

    // Display all configs
    for (const envConfig of allEnvConfigs) {
      if (contents.length > 0) {
        contents.push('') // blank line between environments
      }

      contents.push(`${envConfig.name}:`)

      if (envConfig.rules && envConfig.rules.length > 0) {
        for (const rule of envConfig.rules) {
          const value = this.formatValue(rule.value)
          if (rule.criteria && rule.criteria.length > 0) {
            contents.push(`  - [conditional]: ${value}`)
          } else {
            contents.push(`  - ${value}`)
          }
        }
      } else {
        contents.push(`  - [no rules]`)
      }

      const envUrl = envConfig.id ? `${url}?environment=${envConfig.id}` : url
      json[envConfig.name] = {
        url: envUrl,
        rules: envConfig.rules,
      }
    }

    this.log(contents.join('\n').trim())

    return json
  }
}
