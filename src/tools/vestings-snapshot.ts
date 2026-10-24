import { writeFileSync } from 'fs'
import { join } from 'path'
import { VESTING_NETWORKS } from '../ethereum/vesting/config'

/**
 * Writes the vesting contracts the factory created up to the finalized head, for one network
 * (`ETHEREUM_CHAIN_ID`, mainnet by default), into `src/ethereum/vesting/snapshot-<dataset>.json`.
 * The processor reads those contracts' events by address, and anything after the snapshot by topic,
 * so an old snapshot is still correct, only slower to index past.
 *
 * Usage: RPC_ENDPOINT_ETH=<url> node lib/tools/vestings-snapshot.js
 */
const RANGE = 10_000

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
      const body = (await res.json()) as { result?: T; error?: { message: string } }
      if (body.error) throw new Error(body.error.message)
      return body.result as T
    } catch (e) {
      if (attempt >= 6) throw e
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
}

async function main() {
  const network = VESTING_NETWORKS[process.env.ETHEREUM_CHAIN_ID || '1']
  if (!network) throw new Error(`no vesting factory on chain ${process.env.ETHEREUM_CHAIN_ID}`)
  const url = process.env.RPC_ENDPOINT_ETH || network.rpc
  const head = parseInt((await rpc<{ number: string }>(url, 'eth_getBlockByNumber', ['finalized', false])).number, 16)
  const addresses = new Set<string>()
  for (let from = network.factoryStartBlock; from <= head; from += RANGE) {
    const to = Math.min(from + RANGE - 1, head)
    const logs = await rpc<{ topics: string[] }[]>(url, 'eth_getLogs', [
      { address: network.factory, topics: [network.vestingCreatedTopic], fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) },
    ])
    for (const log of logs) addresses.add('0x' + log.topics[1].slice(-40).toLowerCase())
  }
  const file = join(__dirname, '..', '..', 'src', 'ethereum', 'vesting', `snapshot-${network.dataset}.json`)
  writeFileSync(file, JSON.stringify({ height: head, addresses: [...addresses].sort() }, null, 2) + '\n')
  console.log(`${addresses.size} vesting contracts up to block ${head} written to ${file}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
