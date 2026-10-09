import {
  Authorization,
  AuthorizationState,
  Data,
  Estate,
  EstateHistory,
  Operator,
  Owner,
  Parcel,
  UpdateOperator,
  Wallet,
} from '../../model'
import { parseLandData, LandData } from '../../common/data'
import { toBytes } from '../../common/hex'
import { decodeTokenId, estateId, parcelId } from '../../common/land'
import { EventMeta, LandEvent } from './events'

type HistoryType = 'Owner' | 'Operator' | 'UpdateOperator'

/**
 * The entities one batch reads and writes, keyed by id.
 *
 * Handlers mirror LAND-permissions-graph. graph-node merges a partial `save()` into the stored
 * entity, so every handler mutates only the fields the subgraph handler sets, and leaves the rest
 * as loaded. Relations left `undefined` are not written by the store, which keeps that merge
 * semantic for foreign keys too.
 */
export class LandState {
  readonly parcels = new Map<string, Parcel>()
  readonly estates = new Map<string, Estate>()
  readonly wallets = new Map<string, Wallet>()
  readonly datas = new Map<string, Data>()
  readonly authorizationStates = new Map<string, AuthorizationState>()

  readonly touchedParcels = new Set<string>()
  readonly touchedEstates = new Set<string>()
  readonly newWallets = new Set<string>()
  readonly touchedDatas = new Set<string>()
  readonly touchedAuthorizationStates = new Set<string>()

  readonly authorizations: Authorization[] = []
  readonly owners: Owner[] = []
  readonly operators: Operator[] = []
  readonly updateOperators: UpdateOperator[] = []
  readonly estateHistories: EstateHistory[] = []

  readonly warnings: string[] = []

  constructor(readonly estateRegistry: string) {}
}

function wallet(state: LandState, address: string): Wallet {
  let w = state.wallets.get(address)
  if (!w) {
    w = new Wallet({ id: address, address: toBytes(address) })
    state.wallets.set(address, w)
    state.newWallets.add(address)
  }
  return w
}

function parcelFor(state: LandState, tokenId: bigint): Parcel {
  const id = parcelId(tokenId)
  let p = state.parcels.get(id)
  if (!p) {
    const { x, y } = decodeTokenId(tokenId)
    p = new Parcel({ id, tokenId, x, y })
    state.parcels.set(id, p)
  }
  state.touchedParcels.add(id)
  return p
}

function setCoordinates(p: Parcel, tokenId: bigint) {
  const { x, y } = decodeTokenId(tokenId)
  p.x = x
  p.y = y
  p.tokenId = tokenId
}

function mergeData(state: LandState, id: string, data: LandData): Data {
  let d = state.datas.get(id)
  if (!d) {
    d = new Data({ id, version: data.version })
    state.datas.set(id, d)
  }
  d.version = data.version
  if (data.name !== undefined) d.name = data.name
  if (data.description !== undefined) d.description = data.description
  if (data.ipns !== undefined) d.ipns = data.ipns
  state.touchedDatas.add(id)
  return d
}

function eventFields(ev: EventMeta) {
  return {
    blockNumber: ev.blockNumber,
    logIndex: ev.logIndex,
    transactionHash: ev.transactionHash,
  }
}

/** graph-node's `timestamp * 1e6 + logIndex`, which orders events within a block. */
function eventTimestamp(ev: EventMeta): bigint {
  return ev.timestamp * 1_000_000n + BigInt(ev.logIndex)
}

function history(
  state: LandState,
  type: HistoryType,
  target: { parcel?: Parcel; estate?: Estate },
  eventName: string,
  ev: EventMeta,
  address: string | null
) {
  const fields = {
    id: `${ev.blockNumber}-${ev.logIndex}-${type}`,
    address: address === null ? null : toBytes(address),
    parcel: target.parcel ?? null,
    estate: target.estate ?? null,
    eventName,
    timestamp: eventTimestamp(ev),
    createdAt: ev.timestamp,
    ...eventFields(ev),
  }
  if (type === 'Owner') state.owners.push(new Owner(fields))
  else if (type === 'Operator') state.operators.push(new Operator(fields))
  else state.updateOperators.push(new UpdateOperator(fields))
}

function estateOrWarn(state: LandState, tokenId: bigint, ev: EventMeta): Estate | undefined {
  const e = state.estates.get(estateId(tokenId))
  if (!e) {
    state.warnings.push(`estate ${estateId(tokenId)} not found at block ${ev.blockNumber} log ${ev.logIndex}`)
  }
  return e
}

export function applyLandEvent(state: LandState, ev: LandEvent): void {
  switch (ev.kind) {
    case 'ParcelTransfer': {
      const p = parcelFor(state, ev.tokenId)
      setCoordinates(p, ev.tokenId)
      p.owner = wallet(state, ev.to)
      p.operator = null
      p.updateOperator = null
      p.updatedAt = ev.timestamp
      history(state, 'Owner', { parcel: p }, 'Transfer', ev, ev.to)
      history(state, 'Operator', { parcel: p }, 'Transfer', ev, null)
      history(state, 'UpdateOperator', { parcel: p }, 'Transfer', ev, null)
      return
    }
    case 'ParcelApproval': {
      const p = parcelFor(state, ev.tokenId)
      setCoordinates(p, ev.tokenId)
      p.owner = wallet(state, ev.owner)
      p.operator = toBytes(ev.operator)
      p.updatedAt = ev.timestamp
      history(state, 'Operator', { parcel: p }, 'Approval', ev, ev.operator)
      return
    }
    case 'ParcelUpdateOperator': {
      const p = parcelFor(state, ev.tokenId)
      setCoordinates(p, ev.tokenId)
      p.updateOperator = toBytes(ev.operator)
      p.updatedAt = ev.timestamp
      history(state, 'UpdateOperator', { parcel: p }, 'UpdateOperator', ev, ev.operator)
      return
    }
    case 'ParcelUpdate': {
      const data = parseLandData(ev.data)
      if (data === null) return
      const id = parcelId(ev.tokenId)
      const p = parcelFor(state, ev.tokenId)
      p.data = mergeData(state, id, data)
      return
    }
    case 'Authorization': {
      const owner = wallet(state, ev.owner)
      const operator = toBytes(ev.operator)
      const tokenAddress = toBytes(ev.address)
      state.authorizations.push(
        new Authorization({
          id: `${ev.blockNumber}-${ev.logIndex}-${ev.type}`,
          type: ev.type,
          tokenAddress,
          owner,
          operator,
          isApproved: ev.approved,
          timestamp: eventTimestamp(ev),
          createdAt: ev.timestamp,
          ...eventFields(ev),
        })
      )
      const stateId = `${ev.address}-${ev.owner}-${ev.operator}-${ev.type}`
      let current = state.authorizationStates.get(stateId)
      if (!current) {
        current = new AuthorizationState({ id: stateId, type: ev.type, tokenAddress, owner, operator })
        state.authorizationStates.set(stateId, current)
      }
      current.isApproved = ev.approved
      current.timestamp = eventTimestamp(ev)
      current.blockNumber = ev.blockNumber
      current.logIndex = ev.logIndex
      state.touchedAuthorizationStates.add(stateId)
      return
    }
    case 'EstateTransfer': {
      const id = estateId(ev.tokenId)
      let e = state.estates.get(id)
      if (!e) {
        e = new Estate({ id })
        state.estates.set(id, e)
      }
      e.owner = wallet(state, ev.to)
      e.operator = null
      e.updateOperator = null
      e.updatedAt = ev.timestamp
      state.touchedEstates.add(id)
      history(state, 'Owner', { estate: e }, 'Transfer', ev, ev.to)
      history(state, 'Operator', { estate: e }, 'Transfer', ev, null)
      history(state, 'UpdateOperator', { estate: e }, 'Transfer', ev, null)
      return
    }
    case 'EstateApproval': {
      const id = estateId(ev.tokenId)
      let e = state.estates.get(id)
      if (!e) {
        e = new Estate({ id })
        state.estates.set(id, e)
      }
      e.owner = wallet(state, ev.owner)
      e.operator = toBytes(ev.approved)
      e.updatedAt = ev.timestamp
      state.touchedEstates.add(id)
      history(state, 'Operator', { estate: e }, 'Approval', ev, ev.approved)
      return
    }
    case 'EstateUpdateOperator': {
      // The subgraph would fail to save a new Estate without an owner, so an unknown estate here
      // never happened on chain; skip it rather than invent an owner.
      const e = estateOrWarn(state, ev.tokenId, ev)
      if (!e) return
      e.updateOperator = toBytes(ev.operator)
      e.updatedAt = ev.timestamp
      state.touchedEstates.add(e.id)
      history(state, 'UpdateOperator', { estate: e }, 'UpdateOperator', ev, ev.operator)
      return
    }
    case 'EstateUpdate': {
      const data = parseLandData(ev.data)
      if (data === null) return
      const e = estateOrWarn(state, ev.tokenId, ev)
      if (!e) return
      e.data = mergeData(state, e.id, data)
      state.touchedEstates.add(e.id)
      return
    }
    case 'CreateEstate': {
      const id = estateId(ev.tokenId)
      let e = state.estates.get(id)
      if (!e) {
        e = new Estate({ id })
        state.estates.set(id, e)
      }
      e.owner = wallet(state, ev.owner)
      e.size = 0
      e.createdAt = ev.timestamp
      const data = parseLandData(ev.data)
      if (data !== null) e.data = mergeData(state, id, data)
      state.touchedEstates.add(id)
      return
    }
    case 'AddLand': {
      const e = estateOrWarn(state, ev.estateTokenId, ev)
      if (!e) return
      e.size = (e.size ?? 0) + 1
      state.touchedEstates.add(e.id)
      const p = parcelFor(state, ev.landTokenId)
      p.owner = wallet(state, state.estateRegistry)
      p.estate = e
      state.estateHistories.push(
        new EstateHistory({
          id: `${ev.blockNumber}-${ev.logIndex}-AddLand-${e.id}`,
          estateId: e.id,
          prevEstateId: e.id,
          estateTokenId: e.id,
          parcel: p,
          createdAt: ev.timestamp,
          eventName: 'AddLand',
          ...eventFields(ev),
        })
      )
      return
    }
    case 'RemoveLand': {
      const e = estateOrWarn(state, ev.estateTokenId, ev)
      if (!e) return
      // The subgraph splices the parcel out of a stored list and takes its length; an empty list
      // stays empty, so the size never goes below zero.
      e.size = Math.max(0, (e.size ?? 0) - 1)
      state.touchedEstates.add(e.id)
      const p = parcelFor(state, ev.landTokenId)
      p.owner = wallet(state, ev.destinatary)
      p.estate = null
      state.estateHistories.push(
        new EstateHistory({
          id: `${ev.blockNumber}-${ev.logIndex}-RemoveLand-${e.id}`,
          estateId: null,
          prevEstateId: null,
          estateTokenId: e.id,
          parcel: p,
          createdAt: ev.timestamp,
          eventName: 'RemoveLand',
          ...eventFields(ev),
        })
      )
      return
    }
  }
}
