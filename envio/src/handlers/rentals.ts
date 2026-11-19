// Rentals: the Rentals contract on Ethereum, plus UpdateOperator of LAND and Estate (called from
// ./land.ts). A port of the squid's src/ethereum/rentals/state.ts, which mirrors rentals-graph.

import { indexer, type EvmOnEventContext, type RentalsCount, type RentalsContract } from 'envio'
import { FIELDS, meta, type Meta } from '../common/meta.js'
import { ESTATE_REGISTRY, LAND_REGISTRY } from '../common/constants.js'

type Ctx = EvmOnEventContext

const DAY = 86400n
const ALL_RENTALS = 'all-rentals'
const ALL_INDEXES_UPDATES = 'all-indexes-updates'
const RENTALS_CONTRACT = 'rentals-contract'
const ANALYTICS_TOTAL = 'analytics-total-data'

export function buildRentalId(contractAddress: string, tokenId: bigint, index: bigint): string {
  return `${contractAddress}:${tokenId}:${index}`
}

async function count(context: Ctx, id: string): Promise<RentalsCount> {
  return (await context.RentalsCount.get(id)) ?? { id, value: 0n }
}

async function rentalsContract(context: Ctx): Promise<RentalsContract> {
  return (await context.RentalsContract.get(RENTALS_CONTRACT)) ?? { id: RENTALS_CONTRACT, fee: 0n }
}

async function nextIndexesUpdate(context: Ctx): Promise<string> {
  const c = await count(context, ALL_INDEXES_UPDATES)
  const value = c.value + 1n
  context.RentalsCount.set({ ...c, value })
  return value.toString()
}

function eventFields(m: Meta) {
  return { blockNumber: m.blockNumber, logIndex: m.logIndex, transactionHash: m.transactionHash }
}

indexer.onEvent(
  { contract: 'Rentals', event: 'AssetRented', fields: { block: ['timestamp'], transaction: ['hash', 'to'] } },
  async ({ event, context }) => {
    const m = meta(event)
    const p = event.params
    const contractAddress = p._contractAddress.toLowerCase()
    const tokenId = p._tokenId
    const transactionTo = event.transaction.to
    const current = await count(context, `${contractAddress}-${tokenId}`)
    if (!transactionTo) {
      context.log.warn(`asset rented without a transaction recipient at block ${m.blockNumber}`)
      return
    }
    if (contractAddress !== LAND_REGISTRY && contractAddress !== ESTATE_REGISTRY) {
      context.log.warn(`asset rented from an untracked contract ${contractAddress} at block ${m.blockNumber}`)
    }
    const currentRentalId = buildRentalId(contractAddress, tokenId, current.value)
    const nextValue = current.value + 1n

    const previous = await context.Rental.get(currentRentalId)
    if (previous) context.Rental.set({ ...previous, isActive: false })

    // The two asset-index updates the rent transaction emitted right before this event belong to
    // the rent, not to a cancellation.
    const last = (await count(context, ALL_INDEXES_UPDATES)).value
    const lastAsset = await context.IndexesUpdateAssetHistory.get(last.toString())
    const secondToLastAsset = await context.IndexesUpdateAssetHistory.get((last - 1n).toString())
    if (lastAsset && secondToLastAsset) {
      context.IndexesUpdateAssetHistory.set({ ...lastAsset, type: 'RENT' })
      context.IndexesUpdateAssetHistory.set({ ...secondToLastAsset, type: 'RENT' })
    }

    context.Rental.set({
      id: buildRentalId(contractAddress, tokenId, nextValue),
      contractAddress,
      tokenId,
      lessor: p._lessor.toLowerCase(),
      tenant: p._tenant.toLowerCase(),
      operator: p._operator.toLowerCase(),
      rentalDays: p._rentalDays,
      pricePerDay: p._pricePerDay,
      sender: p._sender.toLowerCase(),
      startedAt: m.timestamp,
      updatedAt: m.timestamp,
      endsAt: m.timestamp + p._rentalDays * DAY,
      signature: p._signature.toLowerCase(),
      isExtension: p._isExtension,
      rentalContractAddress: transactionTo.toLowerCase(),
      ownerHasClaimedAsset: false,
      claimedAt: undefined,
      isActive: true,
      ...eventFields(m),
    })
    context.RentalsCount.set({ ...current, value: nextValue })
    const all = await count(context, ALL_RENTALS)
    context.RentalsCount.set({ ...all, value: all.value + 1n })

    if (!(await context.Rentable.get(contractAddress))) context.Rentable.set({ id: contractAddress })

    const assetId = `${contractAddress}-${tokenId}`
    context.RentalAsset.set({
      id: assetId,
      contractAddress,
      tokenId,
      lessor: p._lessor.toLowerCase(),
      isClaimed: false,
      claimedAt: undefined,
    })

    const fee = (await rentalsContract(context)).fee
    const volume = p._rentalDays * p._pricePerDay
    const feeCollectorEarnings = (volume * fee) / 1_000_000n
    const dayNumber = m.timestamp / DAY
    const dayId = dayNumber.toString()
    const day = (await context.AnalyticsDayData.get(dayId)) ?? {
      id: dayId,
      date: Number(dayNumber * DAY),
      rentals: 0,
      volume: 0n,
      lessorEarnings: 0n,
      feeCollectorEarnings: 0n,
    }
    context.AnalyticsDayData.set({
      ...day,
      rentals: day.rentals + 1,
      volume: day.volume + volume,
      lessorEarnings: day.lessorEarnings + volume - feeCollectorEarnings,
      feeCollectorEarnings: day.feeCollectorEarnings + feeCollectorEarnings,
    })
    const total = (await context.AnalyticsTotalData.get(ANALYTICS_TOTAL)) ?? {
      id: ANALYTICS_TOTAL,
      rentals: 0,
      volume: 0n,
      lessorEarnings: 0n,
      feeCollectorEarnings: 0n,
    }
    context.AnalyticsTotalData.set({
      ...total,
      rentals: total.rentals + 1,
      volume: total.volume + volume,
      lessorEarnings: total.lessorEarnings + volume - feeCollectorEarnings,
      feeCollectorEarnings: total.feeCollectorEarnings + feeCollectorEarnings,
    })
  }
)

indexer.onEvent({ contract: 'Rentals', event: 'AssetClaimed', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const contractAddress = event.params._contractAddress.toLowerCase()
  const tokenId = event.params._tokenId
  const index = (await count(context, `${contractAddress}-${tokenId}`)).value
  const rental = await context.Rental.get(buildRentalId(contractAddress, tokenId, index))
  if (!rental) {
    context.log.warn(`asset claimed for a rental that does not exist: ${contractAddress} ${tokenId}`)
    return
  }
  context.Rental.set({ ...rental, isActive: false, ownerHasClaimedAsset: true, updatedAt: m.timestamp, claimedAt: m.timestamp })
  const asset = await context.RentalAsset.get(`${contractAddress}-${tokenId}`)
  if (!asset) {
    context.log.warn(`rental asset ${contractAddress}-${tokenId} does not exist`)
    return
  }
  context.RentalAsset.set({ ...asset, lessor: undefined, isClaimed: true, claimedAt: m.timestamp })
})

indexer.onEvent({ contract: 'Rentals', event: 'ContractIndexUpdated', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const id = await nextIndexesUpdate(context)
  context.IndexesUpdateContractHistory.set({ id, newIndex: event.params._newIndex, contractAddress: m.address })
  context.IndexesUpdateHistory.set({
    id,
    type: 'CONTRACT',
    date: m.timestamp,
    sender: event.params._sender.toLowerCase(),
    contractUpdate_id: id,
    singerUpdate_id: undefined,
    assetUpdate_id: undefined,
    ...eventFields(m),
  })
})

indexer.onEvent({ contract: 'Rentals', event: 'SignerIndexUpdated', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const id = await nextIndexesUpdate(context)
  context.IndexesUpdateSignerHistory.set({ id, newIndex: event.params._newIndex, signer: event.params._signer.toLowerCase() })
  context.IndexesUpdateHistory.set({
    id,
    type: 'SIGNER',
    date: m.timestamp,
    sender: event.params._sender.toLowerCase(),
    contractUpdate_id: undefined,
    singerUpdate_id: id,
    assetUpdate_id: undefined,
    ...eventFields(m),
  })
})

indexer.onEvent({ contract: 'Rentals', event: 'AssetIndexUpdated', fields: FIELDS }, async ({ event, context }) => {
  const m = meta(event)
  const p = event.params
  const id = await nextIndexesUpdate(context)
  context.IndexesUpdateAssetHistory.set({
    id,
    type: 'CANCEL',
    newIndex: p._newIndex,
    signer: p._signer.toLowerCase(),
    tokenId: p._tokenId,
    contractAddress: p._contractAddress.toLowerCase(),
  })
  context.IndexesUpdateHistory.set({
    id,
    type: 'ASSET',
    date: m.timestamp,
    sender: p._sender.toLowerCase(),
    contractUpdate_id: undefined,
    singerUpdate_id: undefined,
    assetUpdate_id: id,
    ...eventFields(m),
  })
})

indexer.onEvent({ contract: 'Rentals', event: 'FeeUpdated' }, async ({ event, context }) => {
  const contract = await rentalsContract(context)
  context.RentalsContract.set({ ...contract, fee: event.params._to })
})

/**
 * An UpdateOperator of a rented contract (the subgraph's Rentable template). The subgraph only
 * listens to a contract after its first rental; like the squid, only LAND and Estate are followed.
 */
export async function applyRentableUpdateOperator(context: Ctx, m: Meta, tokenId: bigint, operator: string) {
  if (!(await context.Rentable.get(m.address))) return
  const index = (await count(context, `${m.address}-${tokenId}`)).value
  const rental = await context.Rental.get(buildRentalId(m.address, tokenId, index))
  if (!rental) return
  context.Rental.set({ ...rental, operator, updatedAt: m.timestamp })
}
