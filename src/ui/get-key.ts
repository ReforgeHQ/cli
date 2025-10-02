import {Reforge} from '@reforge-com/node'

import {initReforge} from '../reforge.js'
import autocomplete from '../util/autocomplete.js'
import isInteractive from '../util/is-interactive.js'

type Flags = {
  ['sdk-key']?: string
  interactive?: boolean
}

export type CommandLike = {
  err: (input: Error | string, options?: {code?: string | undefined; exit: false}) => void
  error: (input: Error | string, options: {code?: string | undefined; exit: false}) => void
}

const getKey = async ({
  args,
  command,
  flags,
  message,
}: {
  args: {name?: string}
  command: CommandLike
  flags: Flags
  message: string
}): Promise<{key: null | string | undefined; reforge: Reforge | undefined}> => {
  if (!args.name && !isInteractive(flags)) {
    command.err("'name' argument is required when interactive mode isn't available.")
  }

  const reforge = await initReforge(command, flags)

  let key: null | string | undefined = args.name

  if (!key) {
    key = await autocomplete({message, source: () => reforge.keys()})
  }

  return {key, reforge}
}

export default getKey
