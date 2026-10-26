import { VestingNetwork } from './config'
import * as factoryAbi from '../abi/VestingFactory'
import { VESTING_TOPICS } from './events'

export interface LogRequest {
  where: { address?: string[]; topic0: string[] }
  range: { from: number; to?: number }
}

/**
 * The logs the vesting module reads from block `from` on: the factory's creations, the events of the
 * contracts the snapshot knows by address up to its height, and past it any contract's by topic
 * (VestingState keeps only those of contracts the factory created). A range is never empty: an empty
 * one would merge with the others into ranges that never end, and logs would silently go unread.
 */
export function vestingLogRequests(network: VestingNetwork, from: number): LogRequest[] {
  const start = Math.max(from, network.factoryStartBlock)
  const requests: LogRequest[] = [{ where: { address: [network.factory], topic0: [factoryAbi.events.VestingCreated.topic] }, range: { from: start } }]
  if (network.snapshot.addresses.length && start <= network.snapshot.height) {
    requests.push({
      where: { address: network.snapshot.addresses, topic0: VESTING_TOPICS },
      range: { from: start, to: network.snapshot.height },
    })
  }
  requests.push({ where: { topic0: VESTING_TOPICS }, range: { from: Math.max(start, network.snapshot.height + 1) } })
  return requests
}
