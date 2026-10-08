import { blockFromEnv } from '../common/env'

export interface PolygonContracts {
  dataset: string
  thirdPartyRegistry: string
  thirdPartyRegistryStartBlock: number
}

const MAINNET: PolygonContracts = {
  dataset: 'polygon-mainnet',
  thirdPartyRegistry: '0x1c436c1efb4608dffdc8bace99d2b03c314f3348',
  thirdPartyRegistryStartBlock: 26860700,
}

const AMOY: PolygonContracts = {
  dataset: 'polygon-amoy-testnet',
  thirdPartyRegistry: '0x7d7c0b9d97385bada5fec6861e97d0df414af3c3',
  thirdPartyRegistryStartBlock: 12126197,
}

export function getPolygonContracts(): PolygonContracts {
  const chainId = process.env.POLYGON_CHAIN_ID || '137'
  if (chainId === '137') return MAINNET
  if (chainId === '80002') return AMOY
  throw new Error(`Unsupported POLYGON_CHAIN_ID: ${chainId}`)
}

/** Optional upper bound, for bounded local runs and block-pinned comparisons. */
export function getStopBlock(): number | undefined {
  return blockFromEnv('POLYGON_STOP_BLOCK')
}
