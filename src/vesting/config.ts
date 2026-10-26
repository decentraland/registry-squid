import { getEthereumContracts } from '../ethereum/config'
import mainnetSnapshot from './snapshot-ethereum-mainnet.json'
import sepoliaSnapshot from './snapshot-ethereum-sepolia.json'
import mainnetV1Totals from './v1-totals.json'

/** Decentraland's vesting factory on one Ethereum network, and what is known of its contracts. */
export interface VestingNetwork {
  dataset: string
  /** The minimal proxy factory every vesting contract was created with. */
  factory: string
  /**
   * Where the subgraph starts reading the factory, and so where this does: not where the factory was
   * deployed. On mainnet it was deployed at 10,772,475 and created 131 version 1 vestings before
   * this block, which the subgraph, and so governance, never shows.
   */
  factoryStartBlock: number
  /** The public RPC the network's contracts are read with when RPC_ENDPOINT_ETH is not set. */
  rpc: string
  /** The vesting contracts the factory created up to `height` (`npm run vestings:snapshot`). */
  snapshot: { height: number; addresses: string[] }
  /**
   * The totals of the version 1 vesting contracts the subgraph lists, in whole tokens, by address:
   * a version 1 contract does not expose its total, and the subgraph hardcodes them. The rest read 0.
   */
  v1Totals: Record<string, string>
}

/** By dataset, as `getEthereumContracts` names the network. */
export const VESTING_NETWORKS: Record<string, VestingNetwork> = {
  'ethereum-mainnet': {
    dataset: 'ethereum-mainnet',
    factory: '0xe357273545c152f07afe2c38257b7b653fd3f6d0',
    factoryStartBlock: 12732617,
    rpc: 'https://rpc.decentraland.org/mainnet',
    snapshot: mainnetSnapshot,
    v1Totals: mainnetV1Totals,
  },
  'ethereum-sepolia': {
    dataset: 'ethereum-sepolia',
    factory: '0x71c84760df0537f7db286274817462dc2e6c1366',
    factoryStartBlock: 3831258,
    rpc: 'https://rpc.decentraland.org/sepolia',
    snapshot: sepoliaSnapshot,
    v1Totals: {},
  },
}

export function getVestingNetwork(): VestingNetwork {
  const { dataset } = getEthereumContracts()
  const network = VESTING_NETWORKS[dataset]
  if (!network) throw new Error(`No vesting factory on ${dataset}`)
  return network
}
