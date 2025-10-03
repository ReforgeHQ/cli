import {Args, Flags} from '@oclif/core'
import {ProvidedSource} from '@reforge-com/node'

import {APICommand} from '../index.js'
import {ConfigValue, ConfigValueType} from '../reforge-common/src/types.js'
import {JsonObj} from '../result.js'
import getValue from '../ui/get-value.js'
import {TYPE_MAPPING, coerceBool, coerceIntoType} from '../util/coerce.js'
import {checkmark} from '../util/color.js'
import {makeConfidentialValue} from '../util/encryption.js'
import secretFlags, {parsedSecretFlags} from '../util/secret-flags.js'

export default class Create extends APICommand {
  static args = {
    name: Args.string({description: 'name for your new item (e.g. my.new.flag)', required: true}),
  }

  static description = 'Create a new item in Reforge'

  static examples = [
    '<%= config.bin %> <%= command.id %> my.new.flag --type boolean-flag',
    '<%= config.bin %> <%= command.id %> my.new.flag --type boolean-flag --value=true',
    '<%= config.bin %> <%= command.id %> my.new.string --type string --value="hello world"',
    '<%= config.bin %> <%= command.id %> my.new.string --type string --value="hello world" --secret',
    '<%= config.bin %> <%= command.id %> my.new.string --type string --env-var=MY_ENV_VAR_NAME',
    '<%= config.bin %> <%= command.id %> my.new.string --type json --value="{\\"key\\": \\"value\\"}"',
  ]

  static flags = {
    confidential: Flags.boolean({default: false, description: 'mark the value as confidential'}),
    'env-var': Flags.string({description: 'environment variable to get value from'}),
    type: Flags.string({
      options: ['boolean-flag', 'boolean', 'string', 'double', 'int', 'string-list', 'json'],
      required: true,
    }),
    value: Flags.string({description: 'default value for your new item', required: false}),
    ...secretFlags('encrypt the value of this item'),
  }

  public async run(): Promise<JsonObj | void> {
    const {args, flags} = await this.parse(Create)

    if (flags.type === 'boolean-flag') {
      return this.createBooleanFlag(args, flags.value)
    }

    const key = args.name

    const secret = parsedSecretFlags(flags)

    if (flags['env-var'] && flags.value) {
      return this.err('cannot specify both --env-var and --value')
    }

    if (flags['env-var'] && secret.selected) {
      return this.err('cannot specify both --env-var and --secret')
    }

    if (flags.confidential && secret.selected) {
      console.warn("Note: --confidential is implied when using --secret, so you don't need to specify both.")
    }

    if (secret.selected && flags.type !== 'string') {
      return this.err('--secret flag only works with string type')
    }

    let configValue: ConfigValue = {}
    let valueType: ConfigValueType = TYPE_MAPPING[flags.type]

    if (flags['env-var']) {
      configValue = {
        provided: {
          lookup: flags['env-var'],
          source: ProvidedSource.EnvVar,
        },
      }
    } else {
      const valueInput = await getValue({
        desiredValue: flags.value,
        flags,
        message: 'Default value',
        reforge: undefined as any,
      })

      if (valueInput.ok) {
        const rawValue = valueInput.value
        const parsedConfigValue = coerceIntoType(flags.type, rawValue)

        if (!parsedConfigValue) {
          return this.err(`Failed to coerce value into type: ${flags.type}`, {key, phase: 'coercion'})
        }

        configValue = parsedConfigValue[0]
        valueType = parsedConfigValue[1]

        if (secret.selected) {
          const confidentialValueResult = await makeConfidentialValue(this, rawValue, secret, '')

          if (!confidentialValueResult.ok) {
            this.resultMessage(confidentialValueResult)
            return
          }

          configValue = confidentialValueResult.value
        }
      } else {
        return
      }
    }

    if (flags.confidential) {
      configValue.confidential = true
    }

    // Map to CreateConfigRequestDto structure
    const createConfigRequest = {
      key: args.name,
      type: 'config',
      valueType: this.mapValueTypeToString(valueType),
      sendToClientSdk: false,
      default: {
        rules: [
          {
            criteria: [],
            value: this.mapConfigValueToDto(configValue, valueType),
          },
        ],
      },
    }

    this.verboseLog('POST /configs/v1', createConfigRequest)

    const request = await this.apiClient.post('/configs/v1', createConfigRequest)

    if (!request.ok) {
      const errMsg =
        request.status === 409
          ? `Failed to create config: ${key} already exists`
          : `Failed to create config: ${request.status} | ${JSON.stringify(request.error)}`

      return this.err(errMsg, {key, phase: 'creation', serverError: request.error})
    }

    const response = request.json

    const confidentialMaybe = flags.confidential ? '(confidential) ' : ''

    return this.ok(`${checkmark} Created ${confidentialMaybe}config: ${key}`, {key, ...response})
  }

  private async createBooleanFlag(args: {name: string}, rawDefault: string | undefined): Promise<JsonObj | void> {
    const key = args.name

    const defaultValue = coerceBool(rawDefault ?? 'false')

    // Create flag with true and false variants
    const createFlagRequest = {
      key,
      type: 'feature_flag',
      valueType: 'bool',
      sendToClientSdk: true,
      variants: [
        {
          value: {
            type: 'bool',
            value: true,
          },
          name: 'True',
          description: 'Enabled',
        },
        {
          value: {
            type: 'bool',
            value: false,
          },
          name: 'False',
          description: 'Disabled',
        },
      ],
      default: {
        rules: [
          {
            criteria: [],
            value: {
              type: 'bool',
              value: defaultValue,
            },
          },
        ],
      },
    }

    this.verboseLog('POST /flags/v1', createFlagRequest)

    const request = await this.apiClient.post('/flags/v1', createFlagRequest)

    if (!request.ok) {
      const errMsg =
        request.status === 409
          ? `Failed to create boolean flag: ${key} already exists`
          : `Failed to create boolean flag: ${request.status} | ${JSON.stringify(request.error)}`

      return this.err(errMsg, {key, phase: 'creation', serverError: request.error})
    }

    const response = request.json

    return this.ok(`${checkmark} Created boolean flag: ${key}`, {key, ...response})
  }

  private mapConfigValueToDto(configValue: ConfigValue, valueType: ConfigValueType): any {
    const dto: any = {
      type: this.mapValueTypeToString(valueType),
    }

    // Handle provided (env-var) values
    if (configValue.provided) {
      return {
        ...dto,
        provided: {
          source: configValue.provided.source,
          lookup: configValue.provided.lookup,
        },
      }
    }

    // Extract the actual value based on type
    let value: any
    if (configValue.bool !== undefined) {
      value = configValue.bool
    } else if (configValue.string !== undefined) {
      value = configValue.string
    } else if (configValue.int !== undefined) {
      value = configValue.int
    } else if (configValue.double !== undefined) {
      value = configValue.double
    } else if (configValue.stringList !== undefined) {
      value = configValue.stringList.values
    } else if (configValue.json !== undefined) {
      value = configValue.json
    } else if (configValue.duration !== undefined) {
      value = configValue.duration
    } else if (configValue.intRange !== undefined) {
      value = configValue.intRange
    }

    dto.value = value

    if (configValue.confidential) {
      dto.confidential = true
    }

    if (configValue.decryptWith) {
      dto.decryptWith = configValue.decryptWith
    }

    return dto
  }

  private mapValueTypeToString(valueType: ConfigValueType): string {
    const mapping: Partial<Record<ConfigValueType, string>> = {
      [ConfigValueType.Bool]: 'bool',
      [ConfigValueType.String]: 'string',
      [ConfigValueType.Int]: 'int',
      [ConfigValueType.Double]: 'double',
      [ConfigValueType.StringList]: 'string_list',
      [ConfigValueType.Json]: 'json',
      [ConfigValueType.LimitDefinition]: 'limit_definition',
      [ConfigValueType.Duration]: 'duration',
      [ConfigValueType.IntRange]: 'int_range',
      [ConfigValueType.Bytes]: 'bytes',
      [ConfigValueType.LogLevel]: 'log_level',
    }
    return mapping[valueType] || 'string'
  }
}
