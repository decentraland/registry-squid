const PUBLIC_PORTAL = 'https://portal.sqd.dev'

export interface PortalSource {
  url: string
  http: { retryAttempts: number; headers: Record<string, string> }
}

/**
 * The SQD Network Portal stream for a dataset (`ethereum-mainnet`, `polygon-mainnet`, ...).
 *
 * This squid filters a handful of contracts, so its queries stay far below the public portal's
 * size cap and it needs no key. `SQD_PORTAL_URL` points it at another portal (the shared one, or a
 * self-hosted one); `SQD_PORTAL_API_KEY` is sent only when set.
 */
export function portalSource(dataset: string): PortalSource {
  const host = (process.env.SQD_PORTAL_URL || PUBLIC_PORTAL).replace(/\/$/, '')
  const headers: Record<string, string> = {}
  if (process.env.SQD_PORTAL_API_KEY) headers['x-api-key'] = process.env.SQD_PORTAL_API_KEY
  return {
    url: `${host}/datasets/${dataset}`,
    // Portal errors are transient: a 503 while a new chunk replicates, a 529 while the public portal
    // throttles. Retrying forever rides them out instead of crash-looping the processor.
    http: { retryAttempts: Infinity, headers },
  }
}
