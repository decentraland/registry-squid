import { blockFromEnv } from '../common/env'

export interface EthereumContracts {
  dataset: string
  landRegistry: string
  estateRegistry: string
  landStartBlock: number
  estateStartBlock: number
  rentals: string
  rentalsStartBlock: number
}

const MAINNET: EthereumContracts = {
  dataset: 'ethereum-mainnet',
  landRegistry: '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d',
  estateRegistry: '0x959e104e1a4db6317fa58f8295f586e1a978c297',
  landStartBlock: 4944642,
  estateStartBlock: 6236547,
  rentals: '0x3a1469499d0be105d4f77045ca403a5f6dc2f3f5',
  rentalsStartBlock: 16070889,
}

const SEPOLIA: EthereumContracts = {
  dataset: 'ethereum-sepolia',
  landRegistry: '0x42f4ba48791e2de32f5fbf553441c2672864bb33',
  estateRegistry: '0x369a7fbe718c870c79f99fb423882e8dd8b20486',
  landStartBlock: 3831219,
  estateStartBlock: 3831232,
  rentals: '0xe70db6319e9cee3f604909bdade58d1f5c1cf702',
  rentalsStartBlock: 3831254,
}

export function getEthereumContracts(): EthereumContracts {
  const chainId = process.env.ETHEREUM_CHAIN_ID || '1'
  if (chainId === '1') return MAINNET
  if (chainId === '11155111') return SEPOLIA
  throw new Error(`Unsupported ETHEREUM_CHAIN_ID: ${chainId}`)
}

/**
 * Optional lower bound, for bounded local runs only. A run that starts after the contracts' first
 * block has partial LAND state; it is meant for checking one module, such as rentals, in isolation.
 */
export function getStartBlock(): number | undefined {
  return blockFromEnv('ETHEREUM_FROM_BLOCK')
}

/** Optional upper bound, for bounded local runs and block-pinned comparisons. */
export function getStopBlock(): number | undefined {
  return blockFromEnv('ETHEREUM_STOP_BLOCK')
}
