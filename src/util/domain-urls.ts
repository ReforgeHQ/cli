const DEFAULT_DOMAIN = 'reforge.com'

export const getDomain = (): string => process.env.REFORGE_DOMAIN || DEFAULT_DOMAIN

export const getLaunchApiUrl = (domain?: string): string => {
  // Allow full override for local development
  if (process.env.REFORGE_API_BASE_URL_OVERRIDE) {
    return process.env.REFORGE_API_BASE_URL_OVERRIDE
  }

  const actualDomain = domain || getDomain()
  return `https://api.${actualDomain}`
}

export const getIdApiUrl = (domain?: string): string => {
  // Allow full override for local development - used for all OAuth operations
  if (process.env.IDENTITY_BASE_URL_OVERRIDE) {
    return process.env.IDENTITY_BASE_URL_OVERRIDE
  }

  const actualDomain = domain || getDomain()
  return `https://id.${actualDomain}`
}

export const getAppUrl = (domain?: string): string => {
  // Allow explicit override for app URL
  if (process.env.REFORGE_APP_BASE_URL_OVERRIDE) {
    return process.env.REFORGE_APP_BASE_URL_OVERRIDE
  }

  const actualDomain = domain || getDomain()
  return `https://launch.${actualDomain}`
}
