import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

export interface TokenStorageOptions {
  reforgeDir?: string
}

const getReforgeDir = (options?: TokenStorageOptions) => options?.reforgeDir || path.join(os.homedir(), '.reforge')
const getTokenFile = (options?: TokenStorageOptions) => path.join(getReforgeDir(options), 'tokens.json')
const getConfigFile = (options?: TokenStorageOptions) => path.join(getReforgeDir(options), 'config')

export interface TokenData {
  accessToken: string
  expiresAt: number
  refreshToken: string
}

export interface AuthConfig {
  defaultProfile?: string
  profiles: {
    [profileName: string]: {
      workspace: string
      workspaceName?: string
    }
  }
}

const ensureReforgeDir = async (options?: TokenStorageOptions) => {
  const reforgeDir = getReforgeDir(options)
  try {
    await fs.promises.access(reforgeDir, fs.constants.F_OK)
  } catch {
    await fs.promises.mkdir(reforgeDir, {recursive: true})
  }
}

export const saveTokens = async (tokens: TokenData, options?: TokenStorageOptions): Promise<void> => {
  await ensureReforgeDir(options)
  await fs.promises.writeFile(getTokenFile(options), JSON.stringify(tokens, null, 2), 'utf8')
}

export const loadTokens = async (options?: TokenStorageOptions): Promise<TokenData | null> => {
  try {
    const data = await fs.promises.readFile(getTokenFile(options), 'utf8')
    return JSON.parse(data) as TokenData
  } catch {
    return null
  }
}

export const saveAuthConfig = async (config: AuthConfig, options?: TokenStorageOptions): Promise<void> => {
  await ensureReforgeDir(options)

  let configContent = ''

  // Write default profile if specified
  if (config.defaultProfile) {
    configContent += `default_profile = ${config.defaultProfile}\n\n`
  }

  // Write each profile
  for (const [profileName, profileData] of Object.entries(config.profiles)) {
    configContent += `[profile ${profileName}]\n`
    configContent += `workspace = ${profileData.workspace}`
    if (profileData.workspaceName) {
      configContent += ` # ${profileData.workspaceName}`
    }

    configContent += '\n\n'
  }

  await fs.promises.writeFile(getConfigFile(options), configContent, 'utf8')
}

export const loadAuthConfig = async (options?: TokenStorageOptions): Promise<AuthConfig | null> => {
  try {
    const data = await fs.promises.readFile(getConfigFile(options), 'utf8')

    const config: AuthConfig = {
      profiles: {},
    }

    // Parse default profile
    const defaultMatch = data.match(/default_profile\s*=\s*(.+)/)
    if (defaultMatch && defaultMatch[1]) {
      config.defaultProfile = defaultMatch[1].trim()
    }

    // Parse profiles
    const profileRegex = /\[profile\s+(\w+)]\s*\n\s*workspace\s*=\s*([^\s#]+)(?:\s*#\s*(.+))?/g
    let match

    while ((match = profileRegex.exec(data)) !== null) {
      const profileName = match[1]
      const workspace = match[2]
      const workspaceName = match[3]?.trim()

      config.profiles[profileName] = {
        workspace,
        workspaceName,
      }
    }

    return Object.keys(config.profiles).length > 0 ? config : null
  } catch {
    return null
  }
}

export const getActiveProfile = (profileArg?: string): string => profileArg || process.env.REFORGE_PROFILE || 'default'

export const clearAuth = async (options?: TokenStorageOptions): Promise<void> => {
  try {
    await fs.promises.unlink(getTokenFile(options))
  } catch {
    // Ignore if file doesn't exist
  }

  try {
    await fs.promises.unlink(getConfigFile(options))
  } catch {
    // Ignore if file doesn't exist
  }
}
