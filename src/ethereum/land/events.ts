import * as landAbi from '../../abi/LANDRegistry'
import * as estateAbi from '../../abi/EstateRegistry'
import { lower } from '../../common/hex'

export interface EventMeta {
  blockNumber: number
  /** Block timestamp in seconds. */
  timestamp: bigint
  logIndex: number
  transactionHash: string
  /** The emitting contract, lowercase. */
  address: string
}

export type LandEvent = EventMeta &
  (
    | { kind: 'ParcelTransfer'; to: string; tokenId: bigint }
    | { kind: 'ParcelApproval'; owner: string; operator: string; tokenId: bigint }
    | { kind: 'ParcelUpdateOperator'; tokenId: bigint; operator: string }
    | { kind: 'ParcelUpdate'; tokenId: bigint; data: string }
    | { kind: 'EstateTransfer'; to: string; tokenId: bigint }
    | { kind: 'EstateApproval'; owner: string; approved: string; tokenId: bigint }
    | { kind: 'EstateUpdateOperator'; tokenId: bigint; operator: string }
    | { kind: 'EstateUpdate'; tokenId: bigint; data: string }
    | { kind: 'CreateEstate'; owner: string; tokenId: bigint; data: string }
    | { kind: 'AddLand'; estateTokenId: bigint; landTokenId: bigint }
    | { kind: 'RemoveLand'; estateTokenId: bigint; landTokenId: bigint; destinatary: string }
    | { kind: 'Authorization'; type: AuthorizationType; owner: string; operator: string; approved: boolean }
  )

export type AuthorizationType = 'UpdateManager' | 'Operator'

interface RawLog {
  address: string
  topics: string[]
  data: string
  logIndex: number
  transactionHash: string
}

const LAND_TRANSFERS = [
  landAbi.events['Transfer(address indexed,address indexed,uint256 indexed)'],
  landAbi.events['Transfer(address indexed,address indexed,uint256 indexed,address,bytes)'],
  landAbi.events['Transfer(address indexed,address indexed,uint256 indexed,address,bytes,bytes)'],
]

export const LAND_TOPICS = [
  ...LAND_TRANSFERS.map((e) => e.topic),
  landAbi.events.Approval.topic,
  landAbi.events.UpdateOperator.topic,
  landAbi.events.UpdateManager.topic,
  landAbi.events.ApprovalForAll.topic,
  landAbi.events.Update.topic,
]

export const ESTATE_TOPICS = [
  estateAbi.events.Transfer.topic,
  estateAbi.events.Approval.topic,
  estateAbi.events.UpdateOperator.topic,
  estateAbi.events.UpdateManager.topic,
  estateAbi.events.ApprovalForAll.topic,
  estateAbi.events.Update.topic,
  estateAbi.events.CreateEstate.topic,
  estateAbi.events.AddLand.topic,
  estateAbi.events.RemoveLand.topic,
]

/**
 * Decodes one log of the LAND or Estate registry. Returns null for logs this squid does not index.
 * The two registries share several topics (Transfer, Approval, UpdateOperator, ...), so dispatch is
 * by emitting address first.
 */
export function decodeLandLog(
  log: RawLog,
  block: { number: number; timestampMs: number },
  contracts: { landRegistry: string; estateRegistry: string }
): LandEvent | null {
  const address = lower(log.address)
  const topic = log.topics[0]
  const meta: EventMeta = {
    blockNumber: block.number,
    timestamp: BigInt(Math.floor(block.timestampMs / 1000)),
    logIndex: log.logIndex,
    transactionHash: log.transactionHash,
    address,
  }

  if (address === contracts.landRegistry) {
    for (const transfer of LAND_TRANSFERS) {
      if (topic === transfer.topic) {
        const e = transfer.decode(log)
        return { ...meta, kind: 'ParcelTransfer', to: lower(e.to), tokenId: e.assetId }
      }
    }
    switch (topic) {
      case landAbi.events.Approval.topic: {
        const e = landAbi.events.Approval.decode(log)
        return { ...meta, kind: 'ParcelApproval', owner: lower(e.owner), operator: lower(e.operator), tokenId: e.assetId }
      }
      case landAbi.events.UpdateOperator.topic: {
        const e = landAbi.events.UpdateOperator.decode(log)
        return { ...meta, kind: 'ParcelUpdateOperator', tokenId: e.assetId, operator: lower(e.operator) }
      }
      case landAbi.events.UpdateManager.topic: {
        const e = landAbi.events.UpdateManager.decode(log)
        return { ...meta, kind: 'Authorization', type: 'UpdateManager', owner: lower(e._owner), operator: lower(e._operator), approved: e._approved }
      }
      case landAbi.events.ApprovalForAll.topic: {
        const e = landAbi.events.ApprovalForAll.decode(log)
        return { ...meta, kind: 'Authorization', type: 'Operator', owner: lower(e.holder), operator: lower(e.operator), approved: e.authorized }
      }
      case landAbi.events.Update.topic: {
        const e = landAbi.events.Update.decode(log)
        return { ...meta, kind: 'ParcelUpdate', tokenId: e.assetId, data: e.data }
      }
    }
    return null
  }

  if (address === contracts.estateRegistry) {
    switch (topic) {
      case estateAbi.events.Transfer.topic: {
        const e = estateAbi.events.Transfer.decode(log)
        return { ...meta, kind: 'EstateTransfer', to: lower(e._to), tokenId: e._tokenId }
      }
      case estateAbi.events.Approval.topic: {
        const e = estateAbi.events.Approval.decode(log)
        return { ...meta, kind: 'EstateApproval', owner: lower(e._owner), approved: lower(e._approved), tokenId: e._tokenId }
      }
      case estateAbi.events.UpdateOperator.topic: {
        const e = estateAbi.events.UpdateOperator.decode(log)
        return { ...meta, kind: 'EstateUpdateOperator', tokenId: e._estateId, operator: lower(e._operator) }
      }
      case estateAbi.events.UpdateManager.topic: {
        const e = estateAbi.events.UpdateManager.decode(log)
        return { ...meta, kind: 'Authorization', type: 'UpdateManager', owner: lower(e._owner), operator: lower(e._operator), approved: e._approved }
      }
      case estateAbi.events.ApprovalForAll.topic: {
        const e = estateAbi.events.ApprovalForAll.decode(log)
        return { ...meta, kind: 'Authorization', type: 'Operator', owner: lower(e._owner), operator: lower(e._operator), approved: e._approved }
      }
      case estateAbi.events.Update.topic: {
        const e = estateAbi.events.Update.decode(log)
        return { ...meta, kind: 'EstateUpdate', tokenId: e._assetId, data: e._data }
      }
      case estateAbi.events.CreateEstate.topic: {
        const e = estateAbi.events.CreateEstate.decode(log)
        return { ...meta, kind: 'CreateEstate', owner: lower(e._owner), tokenId: e._estateId, data: e._data }
      }
      case estateAbi.events.AddLand.topic: {
        const e = estateAbi.events.AddLand.decode(log)
        return { ...meta, kind: 'AddLand', estateTokenId: e._estateId, landTokenId: e._landId }
      }
      case estateAbi.events.RemoveLand.topic: {
        const e = estateAbi.events.RemoveLand.decode(log)
        return { ...meta, kind: 'RemoveLand', estateTokenId: e._estateId, landTokenId: e._landId, destinatary: lower(e._destinatary) }
      }
    }
  }

  return null
}
