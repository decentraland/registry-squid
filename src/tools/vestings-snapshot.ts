import { writeFileSync } from 'fs'
import { join } from 'path'
import { RpcClient } from '@subsquid/rpc-client'
import * as factoryAbi from '../abi/VestingFactory'
import { getVestingNetwork } from '../vesting/config'

/**
 * Writes the vesting contracts the factory created up to the finalized head, for the network
 * `ETHEREUM_CHAIN_ID` names (mainnet by default), into `src/vesting/snapshot-<dataset>.json`.
 * The processor reads those contracts' events by address, and anything after the snapshot by topic,
 * so an old snapshot is still correct, only slower to index past.
 *
 * Usage: RPC_ENDPOINT_ETH=<url> npm run vestings:snapshot
 */
const RANGE = 10_000

async function main() {
  const network = getVestingNetwork()
  const rpc = new RpcClient({ url: process.env.RPC_ENDPOINT_ETH || network.rpc, rateLimit: 10, retryAttempts: 10 })
  const head = parseInt((await rpc.call<{ number: string }>('eth_getBlockByNumber', ['finalized', false])).number, 16)
  const addresses = new Set<string>()
  for (let from = network.factoryStartBlock; from <= head; from += RANGE) {
    const to = Math.min(from + RANGE - 1, head)
    const logs = await rpc.call<{ topics: string[] }[]>('eth_getLogs', [
      { address: network.factory, topics: [factoryAbi.events.VestingCreated.topic], fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) },
    ])
    for (const log of logs) addresses.add('0x' + log.topics[1].slice(-40).toLowerCase())
  }
  const file = join(__dirname, '..', '..', 'src', 'vesting', `snapshot-${network.dataset}.json`)
  writeFileSync(file, JSON.stringify({ height: head, addresses: [...addresses].sort() }, null, 2) + '\n')
  console.log(`${addresses.size} vesting contracts up to block ${head} written to ${file}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
