import * as tprAbi from '../../abi/ThirdPartyRegistry'
import { lower } from '../../common/hex'
import { EventMeta } from '../../ethereum/land/events'

export type ThirdPartyEvent = EventMeta &
  (
    | {
        kind: 'ThirdPartyAdded'
        thirdPartyId: string
        metadata: string
        resolver: string
        isApproved: boolean
        managers: string[]
        itemSlots: bigint
        isProgrammatic: boolean
      }
    | {
        kind: 'ThirdPartyUpdated'
        thirdPartyId: string
        metadata: string
        resolver: string
        managers: string[]
        managerValues: boolean[]
        itemSlots: bigint
      }
    | { kind: 'ThirdPartyItemSlotsBought'; thirdPartyId: string; value: bigint }
    | { kind: 'ThirdPartyReviewedWithRoot'; thirdPartyId: string; root: string; isApproved: boolean }
    | { kind: 'ThirdPartyReviewed'; thirdPartyId: string; value: boolean }
    | { kind: 'ItemSlotsConsumed'; thirdPartyId: string; qty: bigint; signer: string; messageHash: string; sender: string }
    | { kind: 'ThirdPartyAggregatorSet'; newAggregator: string }
  )

const ADDED = tprAbi.events['ThirdPartyAdded(string,string,string,bool,address[],uint256,bool,address)']
const ADDED_LEGACY = tprAbi.events['ThirdPartyAdded(string,string,string,bool,address[],uint256,address)']

export const THIRD_PARTY_TOPICS = [
  ADDED.topic,
  ADDED_LEGACY.topic,
  tprAbi.events.ThirdPartyUpdated.topic,
  tprAbi.events.ThirdPartyItemSlotsBought.topic,
  tprAbi.events.ThirdPartyReviewedWithRoot.topic,
  tprAbi.events.ThirdPartyReviewed.topic,
  tprAbi.events.ItemSlotsConsumed.topic,
  tprAbi.events.ThirdPartyAggregatorSet.topic,
]

export function decodeThirdPartyLog(log: { topics: string[]; data: string }, meta: EventMeta): ThirdPartyEvent | null {
  switch (log.topics[0]) {
    case ADDED.topic: {
      const e = ADDED.decode(log)
      return {
        ...meta,
        kind: 'ThirdPartyAdded',
        thirdPartyId: e._thirdPartyId,
        metadata: e._metadata,
        resolver: e._resolver,
        isApproved: e._isApproved,
        managers: e._managers.map(lower),
        itemSlots: e._itemSlots,
        isProgrammatic: e._isProgrammatic,
      }
    }
    case ADDED_LEGACY.topic: {
      const e = ADDED_LEGACY.decode(log)
      return {
        ...meta,
        kind: 'ThirdPartyAdded',
        thirdPartyId: e._thirdPartyId,
        metadata: e._metadata,
        resolver: e._resolver,
        isApproved: e._isApproved,
        managers: e._managers.map(lower),
        itemSlots: e._itemSlots,
        isProgrammatic: false,
      }
    }
    case tprAbi.events.ThirdPartyUpdated.topic: {
      const e = tprAbi.events.ThirdPartyUpdated.decode(log)
      return {
        ...meta,
        kind: 'ThirdPartyUpdated',
        thirdPartyId: e._thirdPartyId,
        metadata: e._metadata,
        resolver: e._resolver,
        managers: e._managers.map(lower),
        managerValues: e._managerValues,
        itemSlots: e._itemSlots,
      }
    }
    case tprAbi.events.ThirdPartyItemSlotsBought.topic: {
      const e = tprAbi.events.ThirdPartyItemSlotsBought.decode(log)
      return { ...meta, kind: 'ThirdPartyItemSlotsBought', thirdPartyId: e._thirdPartyId, value: e._value }
    }
    case tprAbi.events.ThirdPartyReviewedWithRoot.topic: {
      const e = tprAbi.events.ThirdPartyReviewedWithRoot.decode(log)
      return { ...meta, kind: 'ThirdPartyReviewedWithRoot', thirdPartyId: e._thirdPartyId, root: lower(e._root), isApproved: e._isApproved }
    }
    case tprAbi.events.ThirdPartyReviewed.topic: {
      const e = tprAbi.events.ThirdPartyReviewed.decode(log)
      return { ...meta, kind: 'ThirdPartyReviewed', thirdPartyId: e._thirdPartyId, value: e._value }
    }
    case tprAbi.events.ItemSlotsConsumed.topic: {
      const e = tprAbi.events.ItemSlotsConsumed.decode(log)
      return {
        ...meta,
        kind: 'ItemSlotsConsumed',
        thirdPartyId: e._thirdPartyId,
        qty: e._qty,
        signer: lower(e._signer),
        messageHash: lower(e._messageHash),
        sender: lower(e._sender),
      }
    }
    case tprAbi.events.ThirdPartyAggregatorSet.topic: {
      const e = tprAbi.events.ThirdPartyAggregatorSet.decode(log)
      return { ...meta, kind: 'ThirdPartyAggregatorSet', newAggregator: lower(e._newThirdPartyAggregator) }
    }
  }
  return null
}
