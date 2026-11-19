// LAND permissions: LANDRegistry and EstateRegistry on Ethereum.
// A port of the squid's src/ethereum/land/state.ts, one handler per event. The squid mirrors
// LAND-permissions-graph: each handler changes only the fields the subgraph handler sets.

import { indexer, type EvmOnEventContext, type Estate, type Parcel } from 'envio'
import { decodeTokenId, estateId, parcelId, parseLandData, type LandData } from '../common/land.js'
import { EMPTY_METADATA_READS_NULL, ESTATE_REGISTRY, RENTALS_START_BLOCK } from '../common/constants.js'
import { applyRentableUpdateOperator } from './rentals.js'
import { FIELDS, meta, type Meta } from '../common/meta.js'

type Ctx = EvmOnEventContext

/** graph-node's `timestamp * 1e6 + logIndex`, which orders events within a block. */
function eventTimestamp(m: Meta): bigint {
  return m.timestamp * 1_000_000n + BigInt(m.logIndex)
}

function eventFields(m: Meta) {
  return { blockNumber: m.blockNumber, logIndex: m.logIndex, transactionHash: m.transactionHash }
}

/** Wallets never change once created, so writing one again is a no-op. */
function wallet(context: Ctx, address: string): string {
  context.Wallet.set({ id: address, address })
  return address
}

async function loadParcel(context: Ctx, tokenId: bigint): Promise<Parcel> {
  const id = parcelId(tokenId)
  const found = await context.Parcel.get(id)
  if (found) return found
  const { x, y } = decodeTokenId(tokenId)
  return {
    id,
    tokenId,
    x,
    y,
    owner_id: undefined,
    operator: undefined,
    updateOperator: undefined,
    estate_id: undefined,
    data_id: undefined,
    updatedAt: undefined,
  }
}

function withCoordinates(p: Parcel, tokenId: bigint): Parcel {
  const { x, y } = decodeTokenId(tokenId)
  return { ...p, x, y, tokenId }
}

async function loadEstate(context: Ctx, tokenId: bigint, owner: string): Promise<Estate> {
  const id = estateId(tokenId)
  const found = await context.Estate.get(id)
  if (found) return found
  return {
    id,
    owner_id: owner,
    operator: undefined,
    updateOperator: undefined,
    size: undefined,
    data_id: undefined,
    createdAt: undefined,
    updatedAt: undefined,
  }
}

/** The subgraph would fail to save a new Estate without an owner: an unknown one is skipped. */
async function estateOrWarn(context: Ctx, tokenId: bigint, m: Meta): Promise<Estate | undefined> {
  const e = await context.Estate.get(estateId(tokenId))
  if (!e) context.log.warn(`estate ${estateId(tokenId)} not found at block ${m.blockNumber} log ${m.logIndex}`)
  return e
}

/** Merges parsed metadata into the stored Data, keeping fields the CSV leaves out. */
async function mergeData(
  context: Ctx,
  id: string,
  data: LandData,
  owner: { parcel_id?: string; estate_id?: string }
): Promise<string> {
  const found = await context.Data.get(id)
  const value = (v: string) => (v === '' && EMPTY_METADATA_READS_NULL ? undefined : v)
  context.Data.set({
    id,
    parcel_id: owner.parcel_id ?? found?.parcel_id,
    estate_id: owner.estate_id ?? found?.estate_id,
    version: data.version,
    name: data.name !== undefined ? value(data.name) : found?.name,
    description: data.description !== undefined ? value(data.description) : found?.description,
    ipns: data.ipns !== undefined ? value(data.ipns) : found?.ipns,
  })
  return id
}

type HistoryType = 'Owner' | 'Operator' | 'UpdateOperator'

function history(
  context: Ctx,
  type: HistoryType,
  target: { parcel_id?: string; estate_id?: string },
  eventName: string,
  m: Meta,
  address: string | undefined
) {
  const row = {
    id: `${m.blockNumber}-${m.logIndex}-${type}`,
    address,
    parcel_id: target.parcel_id,
    estate_id: target.estate_id,
    eventName,
    timestamp: eventTimestamp(m),
    createdAt: m.timestamp,
    ...eventFields(m),
  }
  if (type === 'Owner') context.Owner.set(row)
  else if (type === 'Operator') context.Operator.set(row)
  else context.UpdateOperator.set(row)
}

// --- Parcels -------------------------------------------------------------------------------

async function parcelTransfer(context: Ctx, m: Meta, to: string, tokenId: bigint) {
  const p = withCoordinates(await loadParcel(context, tokenId), tokenId)
  context.Parcel.set({
    ...p,
    owner_id: wallet(context, to),
    operator: undefined,
    updateOperator: undefined,
    updatedAt: m.timestamp,
  })
  history(context, 'Owner', { parcel_id: p.id }, 'Transfer', m, to)
  history(context, 'Operator', { parcel_id: p.id }, 'Transfer', m, undefined)
  history(context, 'UpdateOperator', { parcel_id: p.id }, 'Transfer', m, undefined)
}

indexer.onEvent({ contract: 'LANDRegistry', event: 'Transfer', fields: FIELDS }, async ({ event, context }) => {
  await parcelTransfer(context, meta(event), event.params.to.toLowerCase(), event.params.assetId)
})
indexer.onEvent({ contract: 'LANDRegistry', event: 'TransferWithUserData', fields: FIELDS }, async ({ event, context }) => {
  await parcelTransfer(context, meta(event), event.params.to.toLowerCase(), event.params.assetId)
})
indexer.onEvent({ contract: 'LANDRegistry', event: 'TransferWithOperatorData', fields: FIELDS }, async ({ event, context }) => {
  await parcelTransfer(context, meta(event), event.params.to.toLowerCase(), event.params.assetId)
})

indexer.onEvent({ contract: 'LANDRegistry', event: 'Approval', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const tokenId = event.params.assetId
  const operator = event.params.operator.toLowerCase()
  const p = withCoordinates(await loadParcel(context, tokenId), tokenId)
  context.Parcel.set({
    ...p,
    owner_id: wallet(context, event.params.owner.toLowerCase()),
    operator,
    updatedAt: m.timestamp,
  })
  history(context, 'Operator', { parcel_id: p.id }, 'Approval', m, operator)
})

indexer.onEvent({ contract: 'LANDRegistry', event: 'UpdateOperator', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const tokenId = event.params.assetId
  const operator = event.params.operator.toLowerCase()
  const p = withCoordinates(await loadParcel(context, tokenId), tokenId)
  context.Parcel.set({ ...p, updateOperator: operator, updatedAt: m.timestamp })
  history(context, 'UpdateOperator', { parcel_id: p.id }, 'UpdateOperator', m, operator)
  // The rentals subgraph's Rentable template listens to the same event.
  if (m.blockNumber >= RENTALS_START_BLOCK) await applyRentableUpdateOperator(context, m, tokenId, operator)
})

indexer.onEvent({ contract: 'LANDRegistry', event: 'Update' }, async ({ event, context }) => {
  const data = parseLandData(event.params.data)
  if (data === null) return
  const tokenId = event.params.assetId
  const p = await loadParcel(context, tokenId)
  context.Parcel.set({ ...p, data_id: await mergeData(context, p.id, data, { parcel_id: p.id }) })
})

// --- Authorizations (both registries) --------------------------------------------------------

async function authorization(
  context: Ctx,
  m: Meta,
  type: 'UpdateManager' | 'Operator',
  ownerAddress: string,
  operator: string,
  approved: boolean
) {
  const owner = wallet(context, ownerAddress)
  context.Authorization.set({
    id: `${m.blockNumber}-${m.logIndex}-${type}`,
    type,
    tokenAddress: m.address,
    owner_id: owner,
    operator,
    isApproved: approved,
    timestamp: eventTimestamp(m),
    createdAt: m.timestamp,
    ...eventFields(m),
  })
  context.AuthorizationState.set({
    id: `${m.address}-${ownerAddress}-${operator}-${type}`,
    type,
    tokenAddress: m.address,
    owner_id: owner,
    operator,
    isApproved: approved,
    timestamp: eventTimestamp(m),
    blockNumber: m.blockNumber,
    logIndex: m.logIndex,
  })
}

indexer.onEvent({ contract: 'LANDRegistry', event: 'UpdateManager', fields: FIELDS }, async ({ event, context }) => {
  const { _owner, _operator, _approved } = event.params
  await authorization(context, meta(event), 'UpdateManager', _owner.toLowerCase(), _operator.toLowerCase(), _approved)
})
indexer.onEvent({ contract: 'LANDRegistry', event: 'ApprovalForAll', fields: FIELDS }, async ({ event, context }) => {
  const { holder, operator, authorized } = event.params
  await authorization(context, meta(event), 'Operator', holder.toLowerCase(), operator.toLowerCase(), authorized)
})
indexer.onEvent({ contract: 'EstateRegistry', event: 'UpdateManager', fields: FIELDS }, async ({ event, context }) => {
  const { _owner, _operator, _approved } = event.params
  await authorization(context, meta(event), 'UpdateManager', _owner.toLowerCase(), _operator.toLowerCase(), _approved)
})
indexer.onEvent({ contract: 'EstateRegistry', event: 'ApprovalForAll', fields: FIELDS }, async ({ event, context }) => {
  const { _owner, _operator, _approved } = event.params
  await authorization(context, meta(event), 'Operator', _owner.toLowerCase(), _operator.toLowerCase(), _approved)
})

// --- Estates --------------------------------------------------------------------------------

indexer.onEvent({ contract: 'EstateRegistry', event: 'Transfer', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const to = event.params._to.toLowerCase()
  const e = await loadEstate(context, event.params._tokenId, to)
  context.Estate.set({
    ...e,
    owner_id: wallet(context, to),
    operator: undefined,
    updateOperator: undefined,
    updatedAt: m.timestamp,
  })
  history(context, 'Owner', { estate_id: e.id }, 'Transfer', m, to)
  history(context, 'Operator', { estate_id: e.id }, 'Transfer', m, undefined)
  history(context, 'UpdateOperator', { estate_id: e.id }, 'Transfer', m, undefined)
})

indexer.onEvent({ contract: 'EstateRegistry', event: 'Approval', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const owner = event.params._owner.toLowerCase()
  const approved = event.params._approved.toLowerCase()
  const e = await loadEstate(context, event.params._tokenId, owner)
  context.Estate.set({ ...e, owner_id: wallet(context, owner), operator: approved, updatedAt: m.timestamp })
  history(context, 'Operator', { estate_id: e.id }, 'Approval', m, approved)
})

indexer.onEvent({ contract: 'EstateRegistry', event: 'UpdateOperator', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const tokenId = event.params._estateId
  const operator = event.params._operator.toLowerCase()
  const e = await estateOrWarn(context, tokenId, m)
  if (e) {
    context.Estate.set({ ...e, updateOperator: operator, updatedAt: m.timestamp })
    history(context, 'UpdateOperator', { estate_id: e.id }, 'UpdateOperator', m, operator)
  }
  if (m.blockNumber >= RENTALS_START_BLOCK) await applyRentableUpdateOperator(context, m, tokenId, operator)
})

indexer.onEvent({ contract: 'EstateRegistry', event: 'Update', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const data = parseLandData(event.params._data)
  if (data === null) return
  const e = await estateOrWarn(context, event.params._assetId, m)
  if (!e) return
  context.Estate.set({ ...e, data_id: await mergeData(context, e.id, data, { estate_id: e.id }) })
})

indexer.onEvent({ contract: 'EstateRegistry', event: 'CreateEstate', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const owner = event.params._owner.toLowerCase()
  const e = await loadEstate(context, event.params._estateId, owner)
  const data = parseLandData(event.params._data)
  context.Estate.set({
    ...e,
    owner_id: wallet(context, owner),
    size: 0,
    createdAt: m.timestamp,
    data_id: data !== null ? await mergeData(context, e.id, data, { estate_id: e.id }) : e.data_id,
  })
})

indexer.onEvent({ contract: 'EstateRegistry', event: 'AddLand', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const e = await estateOrWarn(context, event.params._estateId, m)
  if (!e) return
  context.Estate.set({ ...e, size: (e.size ?? 0) + 1 })
  const p = await loadParcel(context, event.params._landId)
  context.Parcel.set({ ...p, owner_id: wallet(context, ESTATE_REGISTRY), estate_id: e.id })
  context.EstateHistory.set({
    id: `${m.blockNumber}-${m.logIndex}-AddLand-${e.id}`,
    estateId: e.id,
    prevEstateId: e.id,
    estateTokenId: e.id,
    parcel_id: p.id,
    createdAt: m.timestamp,
    eventName: 'AddLand',
    ...eventFields(m),
  })
})

indexer.onEvent({ contract: 'EstateRegistry', event: 'RemoveLand', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const e = await estateOrWarn(context, event.params._estateId, m)
  if (!e) return
  // The subgraph splices the parcel out of a stored list: the size never goes below zero.
  context.Estate.set({ ...e, size: Math.max(0, (e.size ?? 0) - 1) })
  const p = await loadParcel(context, event.params._landId)
  context.Parcel.set({ ...p, owner_id: wallet(context, event.params._destinatary.toLowerCase()), estate_id: undefined })
  context.EstateHistory.set({
    id: `${m.blockNumber}-${m.logIndex}-RemoveLand-${e.id}`,
    estateId: undefined,
    prevEstateId: undefined,
    estateTokenId: e.id,
    parcel_id: p.id,
    createdAt: m.timestamp,
    eventName: 'RemoveLand',
    ...eventFields(m),
  })
})
