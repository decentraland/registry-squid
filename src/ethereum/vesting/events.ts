import * as factoryAbi from '../../abi/VestingFactory'
import * as v1Abi from '../../abi/TokenVesting'
import * as v2Abi from '../../abi/PeriodicTokenVesting'
import { lower } from '../../common/hex'
import { VestingNetwork } from './config'

/** What a vesting event needs from its block. */
export interface VestingMeta {
  blockNumber: number
  /** Seconds. */
  timestamp: bigint
}

export type VestingEvent = VestingMeta &
  (
    | { kind: 'VestingCreated'; vesting: string }
    | { kind: 'ReleasedV1'; vesting: string; amount: bigint }
    | { kind: 'ReleasedV2'; vesting: string; amount: bigint }
    | { kind: 'Paused' | 'Unpaused' | 'Revoked'; vesting: string }
  )

/** The events of the vesting contracts the subgraph reads, of both versions. */
export const VESTING_TOPICS = [
  v1Abi.events.Released.topic,
  v2Abi.events.Released.topic,
  v2Abi.events.Paused.topic,
  v2Abi.events.Unpaused.topic,
  v1Abi.events.Revoked.topic,
]

/**
 * The vesting event of a log: a creation from the factory, or an event of a vesting contract. The
 * latter are read by topic past the snapshot, so any contract may emit them: the caller keeps only
 * those of known vesting contracts.
 */
export function decodeVestingLog(
  log: { address: string; topics: string[]; data: string },
  meta: VestingMeta,
  network: VestingNetwork
): VestingEvent | undefined {
  const address = lower(log.address)
  const topic = log.topics[0]
  if (address === network.factory) {
    if (topic !== factoryAbi.events.VestingCreated.topic) return undefined
    return { ...meta, kind: 'VestingCreated', vesting: lower(factoryAbi.events.VestingCreated.decode(log)._address) }
  }
  // Read by topic past the snapshot, these may come from any contract, and one whose event has another
  // layout (an indexed amount, say) fails to decode: it is not a vesting's, and must not stop the
  // processor.
  try {
    return decodeVestingEvent(address, topic, log, meta)
  } catch {
    return undefined
  }
}

function decodeVestingEvent(address: string, topic: string, log: { topics: string[]; data: string }, meta: VestingMeta): VestingEvent | undefined {
  switch (topic) {
    case v1Abi.events.Released.topic:
      return { ...meta, kind: 'ReleasedV1', vesting: address, amount: v1Abi.events.Released.decode(log).amount }
    case v2Abi.events.Released.topic:
      return { ...meta, kind: 'ReleasedV2', vesting: address, amount: v2Abi.events.Released.decode(log)._amount }
    case v2Abi.events.Paused.topic:
      return { ...meta, kind: 'Paused', vesting: address }
    case v2Abi.events.Unpaused.topic:
      return { ...meta, kind: 'Unpaused', vesting: address }
    case v1Abi.events.Revoked.topic:
      return { ...meta, kind: 'Revoked', vesting: address }
    default:
      return undefined
  }
}
