import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const REFORGE_DIR = path.join(os.homedir(), '.reforge')
const TOKEN_FILE = path.join(REFORGE_DIR, 'tokens.json')
const CONFIG_FILE = path.join(REFORGE_DIR, 'config')

export interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number
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

const ensureReforgeDir = async () => {
  try {
    await fs.promises.access(REFORGE_DIR, fs.constants.F_OK)
  } catch {
    await fs.promises.mkdir(REFORGE_DIR, {recursive: true})
  }
}

export const saveTokens = async (tokens: TokenData): Promise<void> => {
  await ensureReforgeDir()
  await fs.promises.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8')
}

export const loadTokens = async (): Promise<TokenData | null> => {
  try {
    const data = await fs.promises.readFile(TOKEN_FILE, 'utf8')
    return JSON.parse(data) as TokenData
  } catch {
    return null
  }
}

export const saveAuthConfig = async (config: AuthConfig): Promise<void> => {
  await ensureReforgeDir()

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

  await fs.promises.writeFile(CONFIG_FILE, configContent, 'utf8')
}

export const loadAuthConfig = async (): Promise<AuthConfig | null> => {
  try {
    const data = await fs.promises.readFile(CONFIG_FILE, 'utf8')

    const config: AuthConfig = {
      profiles: {},
    }

    // Parse default profile
    const defaultMatch = data.match(/default_profile\s*=\s*(.+)/)
    if (defaultMatch && defaultMatch[1]) {
      config.defaultProfile = defaultMatch[1].trim()
    }

    // Parse profiles
    const profileRegex = /\[profile\s+(\w+)\]\s*\n\s*workspace\s*=\s*([^\s#]+)(?:\s*#\s*(.+))?/g
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

export const getActiveProfile = (profileArg?: string): string => {
  return profileArg || process.env.REFORGE_PROFILE || 'default'
}

export const clearAuth = async (): Promise<void> => {
  try {
    await fs.promises.unlink(TOKEN_FILE)
  } catch {
    // Ignore if file doesn't exist
  }

  try {
    await fs.promises.unlink(CONFIG_FILE)
  } catch {
    // Ignore if file doesn't exist
  }
}
