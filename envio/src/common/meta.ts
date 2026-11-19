// The event fields the Ethereum handlers share.

/** What every LAND handler reads from its event. */
export interface Meta {
  blockNumber: number
  /** Block timestamp in seconds. */
  timestamp: bigint
  logIndex: number
  transactionHash: string
  /** The emitting contract, lowercase. */
  address: string
}

export const FIELDS = { block: ['timestamp'], transaction: ['hash'] } as const

export function meta(event: {
  block: { number: number; timestamp: number }
  logIndex: number
  transaction: { hash: string }
  srcAddress: string
}): Meta {
  return {
    blockNumber: event.block.number,
    timestamp: BigInt(event.block.timestamp),
    logIndex: event.logIndex,
    transactionHash: event.transaction.hash,
    address: event.srcAddress.toLowerCase(),
  }
}
