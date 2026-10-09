import * as rentalsAbi from '../../abi/Rentals'
import { lower } from '../../common/hex'
import { EventMeta } from '../land/events'

export type RentalsEvent = EventMeta &
  (
    | {
        kind: 'AssetRented'
        contractAddress: string
        tokenId: bigint
        lessor: string
        tenant: string
        operator: string
        rentalDays: bigint
        pricePerDay: bigint
        isExtension: boolean
        sender: string
        signature: string
        /** `to` of the transaction that emitted the event, which the subgraph stores as the rental contract. */
        transactionTo: string | null
      }
    | { kind: 'AssetClaimed'; contractAddress: string; tokenId: bigint }
    | { kind: 'ContractIndexUpdated'; newIndex: bigint; sender: string }
    | { kind: 'SignerIndexUpdated'; signer: string; newIndex: bigint; sender: string }
    | { kind: 'AssetIndexUpdated'; signer: string; contractAddress: string; tokenId: bigint; newIndex: bigint; sender: string }
    | { kind: 'FeeUpdated'; to: bigint }
    /** An UpdateOperator of a rented contract (the subgraph's Rentable template). */
    | { kind: 'RentableUpdateOperator'; contractAddress: string; tokenId: bigint; operator: string }
  )

export const RENTALS_TOPICS = [
  rentalsAbi.events.AssetRented.topic,
  rentalsAbi.events.AssetClaimed.topic,
  rentalsAbi.events.ContractIndexUpdated.topic,
  rentalsAbi.events.SignerIndexUpdated.topic,
  rentalsAbi.events.AssetIndexUpdated.topic,
  rentalsAbi.events.FeeUpdated.topic,
]

export function decodeRentalsLog(
  log: { topics: string[]; data: string },
  meta: EventMeta,
  transactionTo: string | null
): RentalsEvent | null {
  switch (log.topics[0]) {
    case rentalsAbi.events.AssetRented.topic: {
      const e = rentalsAbi.events.AssetRented.decode(log)
      return {
        ...meta,
        kind: 'AssetRented',
        contractAddress: lower(e._contractAddress),
        tokenId: e._tokenId,
        lessor: lower(e._lessor),
        tenant: lower(e._tenant),
        operator: lower(e._operator),
        rentalDays: e._rentalDays,
        pricePerDay: e._pricePerDay,
        isExtension: e._isExtension,
        sender: lower(e._sender),
        signature: lower(e._signature),
        transactionTo: transactionTo === null ? null : lower(transactionTo),
      }
    }
    case rentalsAbi.events.AssetClaimed.topic: {
      const e = rentalsAbi.events.AssetClaimed.decode(log)
      return { ...meta, kind: 'AssetClaimed', contractAddress: lower(e._contractAddress), tokenId: e._tokenId }
    }
    case rentalsAbi.events.ContractIndexUpdated.topic: {
      const e = rentalsAbi.events.ContractIndexUpdated.decode(log)
      return { ...meta, kind: 'ContractIndexUpdated', newIndex: e._newIndex, sender: lower(e._sender) }
    }
    case rentalsAbi.events.SignerIndexUpdated.topic: {
      const e = rentalsAbi.events.SignerIndexUpdated.decode(log)
      return { ...meta, kind: 'SignerIndexUpdated', signer: lower(e._signer), newIndex: e._newIndex, sender: lower(e._sender) }
    }
    case rentalsAbi.events.AssetIndexUpdated.topic: {
      const e = rentalsAbi.events.AssetIndexUpdated.decode(log)
      return {
        ...meta,
        kind: 'AssetIndexUpdated',
        signer: lower(e._signer),
        contractAddress: lower(e._contractAddress),
        tokenId: e._tokenId,
        newIndex: e._newIndex,
        sender: lower(e._sender),
      }
    }
    case rentalsAbi.events.FeeUpdated.topic: {
      const e = rentalsAbi.events.FeeUpdated.decode(log)
      return { ...meta, kind: 'FeeUpdated', to: e._to }
    }
  }
  return null
}
