# Reforge CLI

<!-- toc -->
* [Reforge CLI](#reforge-cli)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g @reforge-com/cli
$ reforge COMMAND
running command...
$ reforge (--version)
@reforge-com/cli/0.0.7 darwin-arm64 node-v24.4.0
$ reforge --help [COMMAND]
USAGE
  $ reforge COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`reforge create NAME`](#reforge-create-name)
* [`reforge download`](#reforge-download)
* [`reforge generate`](#reforge-generate)
* [`reforge generate-new-hex-key`](#reforge-generate-new-hex-key)
* [`reforge get [NAME]`](#reforge-get-name)
* [`reforge info [NAME]`](#reforge-info-name)
* [`reforge interactive`](#reforge-interactive)
* [`reforge list`](#reforge-list)
* [`reforge login`](#reforge-login)
* [`reforge logout`](#reforge-logout)
* [`reforge mcp`](#reforge-mcp)
* [`reforge override [NAME]`](#reforge-override-name)
* [`reforge profile`](#reforge-profile)
* [`reforge schema NAME`](#reforge-schema-name)
* [`reforge serve DATA-FILE`](#reforge-serve-data-file)
* [`reforge set-default [NAME]`](#reforge-set-default-name)
* [`reforge whoami`](#reforge-whoami)
* [`reforge workspace`](#reforge-workspace)

## `reforge create NAME`

Create a new item in Reforge

```
USAGE
  $ reforge create NAME --type boolean-flag|boolean|string|double|int|string-list|json [--json]
    [--interactive] [--no-color] [--verbose] [-p <value>] [--confidential] [--env-var <value>] [--value <value>]
    [--secret] [--secret-key-name <value>]

ARGUMENTS
  NAME  name for your new item (e.g. my.new.flag)

FLAGS
  --confidential             mark the value as confidential
  --env-var=<value>          environment variable to get value from
  --secret                   encrypt the value of this item
  --secret-key-name=<value>  [default: reforge.secrets.encryption.key] name of the secret key to use for
                             encryption/decryption
  --type=<option>            (required)
                             <options: boolean-flag|boolean|string|double|int|string-list|json>
  --value=<value>            default value for your new item

GLOBAL FLAGS
  -p, --profile=<value>   Profile to use (defaults to ENV var REFORGE_PROFILE or "default")
      --[no-]interactive  Force interactive mode
      --json              Format output as json.
      --no-color          Do not colorize output
      --verbose           Verbose output

DESCRIPTION
  Create a new item in Reforge

EXAMPLES
  $ reforge create my.new.flag --type boolean-flag

  $ reforge create my.new.flag --type boolean-flag --value=true

  $ reforge create my.new.string --type string --value="hello world"

  $ reforge create my.new.string --type string --value="hello world" --secret

  $ reforge create my.new.string --type string --env-var=MY_ENV_VAR_NAME

  $ reforge create my.new.string --type json --value="{\"key\": \"value\"}"
```

_See code: [src/commands/create.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/create.ts)_

## `reforge download`

Download a Datafile for a given environment

```
USAGE
  $ reforge download [--json] [--interactive] [--no-color] [--verbose] [-p <value>] [--environment <value>]
    [--sdk-key <value>]

FLAGS
  --environment=<value>  environment to download
  --sdk-key=<value>      SDK key for authentication (uses legacy download endpoint)

GLOBAL FLAGS
  -p, --profile=<value>   Profile to use (defaults to ENV var REFORGE_PROFILE or "default")
      --[no-]interactive  Force interactive mode
      --json              Format output as json.
      --no-color          Do not colorize output
      --verbose           Verbose output

DESCRIPTION
  Download a Datafile for a given environment

  You can serve a datafile using the `serve` command.

EXAMPLES
  $ reforge download --environment=test

  $ reforge download --environment=test --sdk-key=YOUR_SDK_KEY
```

_See code: [src/commands/download.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/download.ts)_

## `reforge generate`

Generate type definitions for your Reforge configuration

```
USAGE
  $ reforge generate [--json] [--interactive] [--no-color] [--verbose] [-p <value>] [-o <value>] [--targets
    <value>]

FLAGS
  -o, --output-directory=<value>  Override the output directory for generated files
      --targets=<value>           [default: react-ts] Determines for language/framework to generate code for (node-ts,
                                  react-ts)

GLOBAL FLAGS
  -p, --profile=<value>   Profile to use (defaults to ENV var REFORGE_PROFILE or "default")
      --[no-]interactive  Force interactive mode
      --json              Format output as json.
      --no-color          Do not colorize output
      --verbose           Verbose output

DESCRIPTION
  Generate type definitions for your Reforge configuration

  You can use the default type-generation configuration, or by provide your own:

  Format:
  {
  ​  outputDirectory?: string;
  ​  targets?: {
  ​    <language key>?: {
  ​      outputDirectory?: string;
  ​      outputFileName?: string;
  ​    }
  ​  }
  };

  Example:
  ```json
  {
  ​  "outputDirectory": "path/to/your/directory",
  ​  "targets": {
  ​    "react-ts": {
  ​      "outputDirectory": "diff/path/to/your/directory",
  ​      "declarationFileName": "reforge-client-types.d.ts",
  ​      "clientFileName": "reforge-client.ts",
  ​    },
  ​    "node-ts": {
  ​      "declarationFileName": "reforge-server-types.d.ts",
  ​      "clientFileName": "reforge-server.ts",
  ​    }
  ​  }
  }
  ```


EXAMPLES
  $ reforge generate # react-ts only by default

  $ reforge generate --target node-ts # node-ts only

  $ reforge generate --target react-ts,node-ts # both node+react-ts

  $ reforge generate -o ./src/generated # specify output directory

  $ reforge generate --targets node-ts -o ./dist # combine with targets
```

_See code: [src/commands/generate.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/generate.ts)_

## `reforge generate-new-hex-key`

Generate a new hex key suitable for secrets

```
USAGE
  $ reforge generate-new-hex-key [--json] [--interactive] [--no-color] [--verbose]

GLOBAL FLAGS
  --[no-]interactive  Force interactive mode
  --json              Format output as json.
  --no-color          Do not colorize output
  --verbose           Verbose output

DESCRIPTION
  Generate a new hex key suitable for secrets

EXAMPLES
  $ reforge generate-new-hex-key
```

_See code: [src/commands/generate-new-hex-key.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/generate-new-hex-key.ts)_

## `reforge get [NAME]`

Get the value of a config/feature-flag/etc.

```
USAGE
  $ reforge get [NAME] [--json] [--interactive] [--no-color] [--verbose] [-p <value>] [--environment
    <value>]

ARGUMENTS
  NAME  config/feature-flag/etc. name

FLAGS
  --environment=<value>  environment to evaluate in

GLOBAL FLAGS
  -p, --profile=<value>   Profile to use (defaults to ENV var REFORGE_PROFILE or "default")
      --[no-]interactive  Force interactive mode
      --json              Format output as json.
      --no-color          Do not colorize output
      --verbose           Verbose output

DESCRIPTION
  Get the value of a config/feature-flag/etc.

EXAMPLES
  $ reforge get my.config.name

  $ reforge get my.config.name --environment=production
```

_See code: [src/commands/get.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/get.ts)_

## `reforge info [NAME]`

Show details about the provided config/feature-flag/etc.

```
USAGE
  $ reforge info [NAME] [--json] [--interactive] [--no-color] [--verbose] [-p <value>]
    [--exclude-evaluations]

ARGUMENTS
  NAME  config/feature-flag/etc. name

FLAGS
  --exclude-evaluations  Exclude evaluation data

GLOBAL FLAGS
  -p, --profile=<value>   Profile to use (defaults to ENV var REFORGE_PROFILE or "default")
      --[no-]interactive  Force interactive mode
      --json              Format output as json.
      --no-color          Do not colorize output
      --verbose           Verbose output

DESCRIPTION
  Show details about the provided config/feature-flag/etc.

EXAMPLES
  $ reforge info my.config.name
```

_See code: [src/commands/info.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/info.ts)_

## `reforge interactive`

```
USAGE
  $ reforge interactive [--json] [--interactive] [--no-color] [--verbose]

GLOBAL FLAGS
  --[no-]interactive  Force interactive mode
  --json              Format output as json.
  --no-color          Do not colorize output
  --verbose           Verbose output

EXAMPLES
  $ reforge
```

_See code: [src/commands/interactive.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/interactive.ts)_

## `reforge list`

Show keys for your config/feature flags/etc.

```
USAGE
  $ reforge list [--json] [--interactive] [--no-color] [--verbose] [-p <value>] [--configs]
    [--feature-flags] [--log-levels] [--schemas] [--segments]

FLAGS
  --configs        include configs
  --feature-flags  include flags
  --log-levels     include log levels
  --schemas        include schemas
  --segments       include segments

GLOBAL FLAGS
  -p, --profile=<value>   Profile to use (defaults to ENV var REFORGE_PROFILE or "default")
      --[no-]interactive  Force interactive mode
      --json              Format output as json.
      --no-color          Do not colorize output
      --verbose           Verbose output

DESCRIPTION
  Show keys for your config/feature flags/etc.

  All types are returned by default. If you pass one or more type flags (e.g. --configs), only those types will be
  returned

EXAMPLES
  $ reforge list

  $ reforge list --feature-flags
```

_See code: [src/commands/list.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/list.ts)_

## `reforge login`

Log in to Reforge using OAuth

```
USAGE
  $ reforge login [--json] [--interactive] [--no-color] [--verbose] [-p <value>]

FLAGS
  -p, --profile=<value>  Profile name to create or update (defaults to "default")

GLOBAL FLAGS
  --[no-]interactive  Force interactive mode
  --json              Format output as json.
  --no-color          Do not colorize output
  --verbose           Verbose output

DESCRIPTION
  Log in to Reforge using OAuth

EXAMPLES
  $ reforge login

  $ reforge login --profile myprofile
```

_See code: [src/commands/login.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/login.ts)_

## `reforge logout`

Log out and clear stored authentication tokens

```
USAGE
  $ reforge logout [--json] [--interactive] [--no-color] [--verbose]

GLOBAL FLAGS
  --[no-]interactive  Force interactive mode
  --json              Format output as json.
  --no-color          Do not colorize output
  --verbose           Verbose output

DESCRIPTION
  Log out and clear stored authentication tokens

EXAMPLES
  $ reforge logout
```

_See code: [src/commands/logout.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/logout.ts)_

## `reforge mcp`

Configure Reforge MCP server for your AI assistant

```
USAGE
  $ reforge mcp [--json] [--interactive] [--no-color] [--verbose] [--editor claude-code|codeium] [--url
    <value>]

FLAGS
  --editor=<option>  Editor to configure (cursor, vscode, claude, windsurf)
                     <options: claude-code|codeium>
  --url=<value>      Internal URL for testing (defaults to https://launch.reforge.com/api/v1/mcp)

GLOBAL FLAGS
  --[no-]interactive  Force interactive mode
  --json              Format output as json.
  --no-color          Do not colorize output
  --verbose           Verbose output

DESCRIPTION
  Configure Reforge MCP server for your AI assistant

EXAMPLES
  $ reforge mcp

  $ reforge mcp --editor cursor

  $ reforge mcp --url http://local-launch.goatsofreforge.com:3003/api/v1/mcp
```

_See code: [src/commands/mcp.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/mcp.ts)_

## `reforge override [NAME]`

Override the value of an item for your user/SDK key combo

```
USAGE
  $ reforge override [NAME] [--json] [--interactive] [--no-color] [--verbose] [-p <value>] [--environment
    <value>] [--remove] [--value <value>]

ARGUMENTS
  NAME  config/feature-flag/etc. name

FLAGS
  --environment=<value>  environment to override in
  --remove               remove your override (if present)
  --value=<value>        value to use for your override

GLOBAL FLAGS
  -p, --profile=<value>   Profile to use (defaults to ENV var REFORGE_PROFILE or "default")
      --[no-]interactive  Force interactive mode
      --json              Format output as json.
      --no-color          Do not colorize output
      --verbose           Verbose output

DESCRIPTION
  Override the value of an item for your user/SDK key combo

EXAMPLES
  $ reforge override # will prompt for name and value

  $ reforge override my.flag.name --value=true

  $ reforge override my.flag.name --remove

  $ reforge override my.double.config --value=3.14159
```

_See code: [src/commands/override.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/override.ts)_

## `reforge profile`

Manage profiles and set default profile

```
USAGE
  $ reforge profile [--json] [--interactive] [--no-color] [--verbose]

GLOBAL FLAGS
  --[no-]interactive  Force interactive mode
  --json              Format output as json.
  --no-color          Do not colorize output
  --verbose           Verbose output

DESCRIPTION
  Manage profiles and set default profile

EXAMPLES
  $ reforge profile
```

_See code: [src/commands/profile.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/profile.ts)_

## `reforge schema NAME`

Manage schemas for Reforge configs

```
USAGE
  $ reforge schema NAME [--json] [--interactive] [--no-color] [--verbose] [-p <value>] [--get] [--set-zod
    <value>]

ARGUMENTS
  NAME  name of the schema

FLAGS
  --get              get the schema definition
  --set-zod=<value>  set a Zod schema definition

GLOBAL FLAGS
  -p, --profile=<value>   Profile to use (defaults to ENV var REFORGE_PROFILE or "default")
      --[no-]interactive  Force interactive mode
      --json              Format output as json.
      --no-color          Do not colorize output
      --verbose           Verbose output

DESCRIPTION
  Manage schemas for Reforge configs

EXAMPLES
  $ reforge schema my-schema --set-zod="z.object({url: z.string()})"

  $ reforge schema my-schema --get
```

_See code: [src/commands/schema.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/schema.ts)_

## `reforge serve DATA-FILE`

Serve a datafile on a local port

```
USAGE
  $ reforge serve DATA-FILE [--json] [--interactive] [--no-color] [--verbose] [--port <value>]

ARGUMENTS
  DATA-FILE  file to read

FLAGS
  --port=<value>  [default: 3099] port to serve on

GLOBAL FLAGS
  --[no-]interactive  Force interactive mode
  --json              Format output as json.
  --no-color          Do not colorize output
  --verbose           Verbose output

DESCRIPTION
  Serve a datafile on a local port

  You can download a datafile using the `download` command.

  You'll need to update your JavaScript (or React) client to point to this server.

  e.g. `endpoints: ["http://localhost:3099"],`


EXAMPLES
  $ reforge serve ./reforge.test.588.config.json --port=3099
```

_See code: [src/commands/serve.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/serve.ts)_

## `reforge set-default [NAME]`

Set/update the default value for an environment (other rules still apply)

```
USAGE
  $ reforge set-default [NAME] [--json] [--interactive] [--no-color] [--verbose] [-p <value>] [--confidential]
    [--env-var <value>] [--environment <value>] [--value <value>] [--confirm] [--secret] [--secret-key-name <value>]

ARGUMENTS
  NAME  config/feature-flag/etc. name

FLAGS
  --confidential             mark the value as confidential
  --confirm                  confirm without prompt
  --env-var=<value>          environment variable to use as default value
  --environment=<value>      environment to change
  --secret                   encrypt the value of this item
  --secret-key-name=<value>  [default: reforge.secrets.encryption.key] name of the secret key to use for
                             encryption/decryption
  --value=<value>            new default value

GLOBAL FLAGS
  -p, --profile=<value>   Profile to use (defaults to ENV var REFORGE_PROFILE or "default")
      --[no-]interactive  Force interactive mode
      --json              Format output as json.
      --no-color          Do not colorize output
      --verbose           Verbose output

DESCRIPTION
  Set/update the default value for an environment (other rules still apply)

EXAMPLES
  $ reforge set-default my.flag.name # will prompt for value and env

  $ reforge set-default my.flag.name --value=true --environment=staging

  $ reforge set-default my.flag.name --value=true --secret

  $ reforge set-default my.config.name --env-var=MY_ENV_VAR_NAME --environment=production
```

_See code: [src/commands/set-default.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/set-default.ts)_

## `reforge whoami`

Display information about the currently logged in user

```
USAGE
  $ reforge whoami [--json] [--interactive] [--no-color] [--verbose]

GLOBAL FLAGS
  --[no-]interactive  Force interactive mode
  --json              Format output as json.
  --no-color          Do not colorize output
  --verbose           Verbose output

DESCRIPTION
  Display information about the currently logged in user

EXAMPLES
  $ reforge whoami
```

_See code: [src/commands/whoami.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/whoami.ts)_

## `reforge workspace`

Switch active workspace or display current workspace

```
USAGE
  $ reforge workspace [--json] [--interactive] [--no-color] [--verbose]

GLOBAL FLAGS
  --[no-]interactive  Force interactive mode
  --json              Format output as json.
  --no-color          Do not colorize output
  --verbose           Verbose output

DESCRIPTION
  Switch active workspace or display current workspace

EXAMPLES
  $ reforge workspace
```

_See code: [src/commands/workspace.ts](https://github.com/ReforgeHQ/cli/blob/v0.0.7/src/commands/workspace.ts)_
<!-- commandsstop -->

## Local Development

```
mise install
git submodule init
git submodule update
yarn install
yarn build
bin/dev.js
fish -c "cd ../../reforgehq/cli;bin/dev.js"
```

## Releasing

```
yarn version
npm publish --access public
```

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and
create. Any contributions you make are **greatly appreciated**. For detailed contributing
guidelines, please see [CONTRIBUTING.md](CONTRIBUTING.md)
