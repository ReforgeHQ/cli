import {Flags} from '@oclif/core'

import {type Environment, getEnvironments} from '../api/get-environments.js'
import {APICommand} from '../index.js'
import {JsonObj} from '../result.js'
import autocomplete from '../util/autocomplete.js'
import {getAppUrl} from '../util/domain-urls.js'
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
      let errorMsg = configRequest.error?.error || `Failed to fetch config: ${configRequest.status}`
      // Customize "Not found" to include the key name
      if (errorMsg === 'Not found' || configRequest.status === 404) {
        errorMsg = `Key ${key} not found`
      }
      return this.err(errorMsg, {error: errorMsg})
    }

    const fullConfig = configRequest.json

    this.verboseLog('Full config:', fullConfig)

    // Get environments
    const environments = await getEnvironments(this)

    const appUrl = getAppUrl()
    // Use new URL format: /workspaces/{workspaceId}/flags/{key}
    if (!this.workspaceId) {
      return this.err('Workspace ID not found. Please run `reforge login`.')
    }
    const url = `${appUrl}/workspaces/${this.workspaceId}/flags/${key}`

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

    // Collect all environment stats first
    const envStatsArray: Array<{
      name: string
      total: number
      valueBreakdown: Map<string, number>
    }> = []

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
        envStatsArray.push({
          name: env.name,
          total: totalEvaluations,
          valueBreakdown,
        })
      }
    }

    // Sort by total count descending
    envStatsArray.sort((a, b) => b.total - a.total)

    // Deduplicate by environment name (keep the one with more evaluations)
    const seenNames = new Set<string>()
    const uniqueStats = envStatsArray.filter((envStat) => {
      if (seenNames.has(envStat.name)) {
        return false
      }

      seenNames.add(envStat.name)
      return true
    })

    // Display sorted stats
    const contents: string[] = []
    for (const envStat of uniqueStats) {
      contents.push(`${envStat.name}: ${envStat.total.toLocaleString()}`)

      // Keep values in the order they were encountered (insertion order in Map)
      for (const [value, count] of envStat.valueBreakdown.entries()) {
        const percentage = Math.round((count / envStat.total) * 100)
        contents.push(`- ${percentage}% - ${value}`)
      }

      contents.push('')
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

    // Handle old format: {type: 'bool', value: false}
    if (value.type && value.value !== undefined) {
      // Format the value based on type
      if (value.type === 'string') {
        return `"${value.value}"`
      }
      if (value.type === 'json') {
        return JSON.stringify(value.value)
      }
      if (value.type === 'stringList') {
        // Format as comma-separated values
        if (Array.isArray(value.value)) {
          return value.value.join(',')
        }
        return JSON.stringify(value.value)
      }
      return String(value.value)
    }

    // Handle new format: {bool: false}, {string: "test"}, etc.
    if (value.bool !== undefined) {
      return String(value.bool)
    }
    if (value.string !== undefined) {
      return `"${value.string}"`
    }
    if (value.int !== undefined || value.double !== undefined) {
      return String(value.int || value.double)
    }
    if (value.stringList !== undefined) {
      if (Array.isArray(value.stringList)) {
        return value.stringList.join(',')
      }
      return JSON.stringify(value.stringList)
    }
    if (value.json !== undefined) {
      return JSON.stringify(value.json)
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

    // Check if we have any actual evaluation data
    let hasData = false
    for (const envName of Object.keys(statsPerEnv)) {
      const envStats = statsPerEnv[envName] as Record<string, unknown>
      if (Array.isArray(envStats.intervals)) {
        for (const interval of envStats.intervals) {
          if (interval.data && interval.data.length > 0) {
            hasData = true
            break
          }
        }
      }
      if (hasData) break
    }

    if (!hasData) {
      this.log('No evaluations found for the past 24 hours')
      return {error: 'No evaluations found for the past 24 hours'}
    }

    this.displayEvaluationStats(statsPerEnv, environments)

    // Transform statsPerEnv into the expected JSON format
    return this.transformEvaluationStatsForJson(statsPerEnv, environments, startTime, endTime)
  }

  private transformEvaluationStatsForJson(
    statsPerEnv: JsonObj,
    environments: Environment[],
    startTime: number,
    endTime: number,
  ): JsonObj {
    const envResults: Array<{
      counts: Array<{configValue: Record<string, unknown>; count: number}>
      envId: string
      name: string
      total: number
    }> = []

    let grandTotal = 0

    // Process each environment's stats
    for (const env of environments) {
      const envStats = statsPerEnv[env.name] as Record<string, unknown>
      if (!envStats || !Array.isArray(envStats.intervals)) continue

      let totalEvaluations = 0
      const valueCounts: Array<{configValue: Record<string, unknown>; count: number}> = []
      const seenValues = new Map<string, {configValue: Record<string, unknown>; count: number}>()

      // Aggregate data across all intervals for this environment
      for (const interval of envStats.intervals) {
        if (interval.data) {
          for (const dataPoint of interval.data) {
            totalEvaluations += dataPoint.count || 0

            // Create a key for deduplication
            const valueKey = JSON.stringify(dataPoint.selectedValue)
            const existing = seenValues.get(valueKey)

            if (existing) {
              existing.count += dataPoint.count || 0
            } else {
              const entry = {
                configValue: this.transformValueForJson(dataPoint.selectedValue),
                count: dataPoint.count || 0,
              }
              seenValues.set(valueKey, entry)
              valueCounts.push(entry)
            }
          }
        }
      }

      if (totalEvaluations > 0) {
        envResults.push({
          counts: valueCounts,
          envId: env.id,
          name: env.name,
          total: totalEvaluations,
        })
        grandTotal += totalEvaluations
      }
    }

    // Sort by total descending
    envResults.sort((a, b) => b.total - a.total)

    // Deduplicate by environment name (keep the one with more evaluations)
    const seenNames = new Set<string>()
    const uniqueResults = envResults.filter((env) => {
      if (seenNames.has(env.name)) {
        return false
      }

      seenNames.add(env.name)
      return true
    })

    return {
      end: endTime,
      environments: uniqueResults,
      start: startTime,
      total: grandTotal,
    }
  }

  private transformValueForJson(value: Record<string, unknown>): Record<string, unknown> {
    // If already in new format ({bool: true}, {string: "test"}, etc.), return as-is
    if (value.bool !== undefined || value.string !== undefined || value.int !== undefined ||
        value.double !== undefined || value.stringList !== undefined || value.json !== undefined) {
      return value
    }

    // Transform from old format {type: 'bool', value: true} to new format {bool: true}
    if (value.type && value.value !== undefined) {
      return {[value.type as string]: value.value}
    }

    return value
  }

  private formatValue(value: Record<string, unknown>, includeQuotes: boolean = true): string {
    if (!value) return 'null'

    // Handle encrypted values
    if (value.decryptWith) {
      return '[encrypted]'
    }

    // Handle confidential values
    if (value.confidential) {
      return '[confidential]'
    }

    // Handle weighted values (A/B testing)
    if (Array.isArray(value.weightedValues)) {
      const weights = value.weightedValues
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.weight as number) - (a.weight as number))
        .map((wv: Record<string, unknown>) => {
          const percent = (((wv.weight as number) / 1000) * 100).toFixed(1)
          const val = this.extractSimpleValue(wv.value as Record<string, unknown>)
          return `${percent}% ${val}`
        })
      return weights.join(', ')
    }

    // Handle provided values (ENV_VAR)
    if (value.provided) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let str = `${(value.provided as any).lookup}`
      if (value.confidential) {
        str = `\`${str}\``
      }
      str += ' via ENV'
      return str
    }

    // Handle simple values
    // For config display, extract raw value without quotes
    if (!includeQuotes) {
      // Old format: {type: 'string', value: 'abc'}
      if (value.type && value.value !== undefined) {
        if (value.type === 'stringList' && Array.isArray(value.value)) {
          return value.value.join(',')
        }
        return String(value.value)
      }
      // New format: {string: 'abc'}
      if (value.string !== undefined) return String(value.string)
      if (value.bool !== undefined) return String(value.bool)
      if (value.int !== undefined || value.double !== undefined) return String(value.int || value.double)
      if (value.stringList !== undefined && Array.isArray(value.stringList)) {
        return value.stringList.join(',')
      }
      if (value.json !== undefined) return JSON.stringify(value.json)
    }

    return this.extractSimpleValue(value)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseConfig(config: any, environments: Environment[], url: string) {
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
      let displayValue: string

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasNonTrivialCriteria = (rule: any) => {
        if (!rule.criteria || rule.criteria.length === 0) return false
        // ALWAYS_TRUE is not a real criteria - treat it as unconditional
        if (rule.criteria.length === 1 && rule.criteria[0].operator === 'ALWAYS_TRUE') return false
        return true
      }

      if (!envConfig.rules || envConfig.rules.length === 0) {
        // No rules means inherit from default
        displayValue = '[inherit]'
      } else if (envConfig.name === 'Default') {
        // For Default environment, show the unconditional fallback value
        // Find the ALWAYS_TRUE rule (usually the last rule)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fallbackRule = envConfig.rules.find((r: any) =>
          r.criteria?.length === 1 && r.criteria[0].operator === 'ALWAYS_TRUE'
        )
        displayValue = fallbackRule ? this.formatValue(fallbackRule.value, false) : this.formatValue(envConfig.rules[0].value, false)
      } else {
        // For non-default environments with rules
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasConditionalRules = envConfig.rules.some((r: any) => hasNonTrivialCriteria(r))

        if (hasConditionalRules) {
          // Has conditional rules - show [override] with the conditional value
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const overrideRule = envConfig.rules.find((r: any) => hasNonTrivialCriteria(r))
          if (overrideRule) {
            const overrideValue = this.formatValue(overrideRule.value, false)
            displayValue = `[override] \`${overrideValue}\``
          } else {
            displayValue = '[see rules]'
          }
        } else {
          // Only has unconditional rules (ALWAYS_TRUE) - show [see rules] to indicate env has custom config
          displayValue = '[see rules]'
        }
      }

      contents.push(`- ${envConfig.name}: ${displayValue}`)

      const envUrl = envConfig.id ? `${url}?environment=${envConfig.id}` : `${url}?environment=undefined`
      json[envConfig.name] = {
        url: envUrl,
      }

      // Add value to JSON based on rule structure
      if (envConfig.rules && envConfig.rules.length > 0) {
        if (envConfig.name === 'Default') {
          // For Default, show the unconditional fallback value
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fallbackRule = envConfig.rules.find((r: any) =>
            r.criteria?.length === 1 && r.criteria[0].operator === 'ALWAYS_TRUE'
          )
          const valueToShow = fallbackRule ? fallbackRule.value.value : envConfig.rules[0].value.value
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(json[envConfig.name] as any).value = valueToShow
        } else {
          // For non-default environments
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasConditionalRules = envConfig.rules.some((r: any) => hasNonTrivialCriteria(r))

          // Always show [see rules] for non-default envs with rules
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(json[envConfig.name] as any).value = '[see rules]'

          // If there are conditional rules, also add override info
          if (hasConditionalRules) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const overrideRule = envConfig.rules.find((r: any) => hasNonTrivialCriteria(r))
            if (overrideRule) {
              // Extract just the value without formatting
              const overrideValue = overrideRule.value.value
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ;(json[envConfig.name] as any).override = overrideValue
            }
          }
        }
      }
    }

    this.log(contents.join('\n').trim())

    return json
  }
}
