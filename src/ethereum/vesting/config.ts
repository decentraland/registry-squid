import mainnetSnapshot from './snapshot-ethereum-mainnet.json'
import sepoliaSnapshot from './snapshot-ethereum-sepolia.json'
import mainnetV1Totals from './v1-totals.json'

/** Decentraland's vesting factory on one Ethereum network, and what is known of its contracts. */
export interface VestingNetwork {
  dataset: string
  /** The minimal proxy factory every vesting contract was created with. */
  factory: string
  factoryStartBlock: number
  /** `VestingCreated(address indexed, bytes32)` */
  vestingCreatedTopic: string
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

const VESTING_CREATED = '0xeaa996f76fa9fcacd351918a2a275ae6d45845f79256ffbe8c0a87ca608e9970'

export const VESTING_NETWORKS: Record<string, VestingNetwork> = {
  '1': {
    dataset: 'ethereum-mainnet',
    factory: '0xe357273545c152f07afe2c38257b7b653fd3f6d0',
    factoryStartBlock: 12732617,
    vestingCreatedTopic: VESTING_CREATED,
    rpc: 'https://rpc.decentraland.org/mainnet',
    snapshot: mainnetSnapshot,
    v1Totals: mainnetV1Totals,
  },
  '11155111': {
    dataset: 'ethereum-sepolia',
    factory: '0x71c84760df0537f7db286274817462dc2e6c1366',
    factoryStartBlock: 3831258,
    vestingCreatedTopic: VESTING_CREATED,
    rpc: 'https://rpc.decentraland.org/sepolia',
    snapshot: sepoliaSnapshot,
    v1Totals: {},
  },
}

export function getVestingNetwork(): VestingNetwork {
  const chainId = process.env.ETHEREUM_CHAIN_ID || '1'
  const network = VESTING_NETWORKS[chainId]
  if (!network) throw new Error(`Unsupported ETHEREUM_CHAIN_ID: ${chainId}`)
  return network
}
