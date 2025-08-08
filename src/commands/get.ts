import type {GetValue} from '../reforge-common/src/types.js'

import {APICommand} from '../index.js'
import {JsonObj} from '../result.js'
import getKey from '../ui/get-key.js'
import nameArg from '../util/name-arg.js'

type Response = Promise<Error | JsonObj | Record<string, GetValue> | undefined | void>

export default class Get extends APICommand {
  static args = {...nameArg}

  static description = 'Get the value of a config/feature-flag/etc.'

  static examples = ['<%= config.bin %> <%= command.id %> my.config.name']

  public async run(): Response {
    const {args, flags} = await this.parse(Get)

    const {key, reforge} = await getKey({args, command: this, flags, message: 'Which item would you like to get?'})

    if (!key || !reforge) {
      return this.err('Key is required')
    }

    if (!reforge.keys().includes(key)) {
      return this.err(`${key} does not exist`)
    }

    const value = reforge.get(key)

    return this.ok(this.toSuccessJson(value), {[key]: value})
  }
}
