import {
  AnalyticsDayData,
  AnalyticsTotalData,
  IndexesUpdateAssetHistory,
  IndexesUpdateContractHistory,
  IndexesUpdateHistory,
  IndexesUpdateSignerHistory,
  IndexUpdateEventType,
  IndexUpdateType,
  Rentable,
  Rental,
  RentalAsset,
  RentalsContract,
  RentalsCount,
} from '../../model'
import { toBytes } from '../../common/hex'
import { EntityClass, LazyState, Loader } from '../../common/lazy-state'
import { RentalsEvent } from './events'

const DAY = 86400n
const ALL_RENTALS = 'all-rentals'
const ALL_INDEXES_UPDATES = 'all-indexes-updates'
const RENTALS_CONTRACT = 'rentals-contract'
const ANALYTICS_TOTAL = 'analytics-total-data'

export type RentalsLoader = Loader

/** Writes in foreign-key order: the update histories before the history that points at them. */
export const SAVE_ORDER: EntityClass<any>[] = [
  RentalsCount,
  Rentable,
  RentalsContract,
  AnalyticsDayData,
  AnalyticsTotalData,
  IndexesUpdateContractHistory,
  IndexesUpdateSignerHistory,
  IndexesUpdateAssetHistory,
  IndexesUpdateHistory,
  Rental,
  RentalAsset,
]

/**
 * Rentals volume is small (hundreds of rentals), so entities are loaded on demand and cached for
 * the batch instead of prefetched. Handlers mirror rentals-graph, including what it reads without
 * saving: a value the subgraph builds but never saves is not saved here either.
 */
export class RentalsState extends LazyState {}

export function buildRentalId(contractAddress: string, tokenId: bigint, index: bigint): string {
  return `${contractAddress}:${tokenId}:${index}`
}

async function count(state: RentalsState, id: string): Promise<RentalsCount> {
  return (await state.get(RentalsCount, id)) ?? new RentalsCount({ id, value: 0n })
}

async function rentalsContract(state: RentalsState): Promise<RentalsContract> {
  return (await state.get(RentalsContract, RENTALS_CONTRACT)) ?? new RentalsContract({ id: RENTALS_CONTRACT, fee: 0n })
}

async function nextIndexesUpdate(state: RentalsState): Promise<RentalsCount> {
  const c = await count(state, ALL_INDEXES_UPDATES)
  c.value += 1n
  state.save(RentalsCount, c)
  return c
}

function eventFields(ev: RentalsEvent) {
  return { blockNumber: ev.blockNumber, logIndex: ev.logIndex, transactionHash: ev.transactionHash }
}

export async function applyRentalsEvent(state: RentalsState, ev: RentalsEvent): Promise<void> {
  switch (ev.kind) {
    case 'AssetRented': {
      const current = await count(state, `${ev.contractAddress}-${ev.tokenId}`)
      if (ev.transactionTo === null) {
        state.errors.push(`asset rented without a transaction recipient at block ${ev.blockNumber}`)
        return
      }
      const currentRentalId = buildRentalId(ev.contractAddress, ev.tokenId, current.value)
      const nextValue = current.value + 1n
      const rental = new Rental({
        id: buildRentalId(ev.contractAddress, ev.tokenId, nextValue),
        contractAddress: ev.contractAddress,
        tokenId: ev.tokenId,
        lessor: ev.lessor,
        tenant: ev.tenant,
        operator: ev.operator,
        rentalDays: ev.rentalDays,
        pricePerDay: ev.pricePerDay,
        sender: ev.sender,
        startedAt: ev.timestamp,
        updatedAt: ev.timestamp,
        endsAt: ev.timestamp + ev.rentalDays * DAY,
        signature: ev.signature,
        isExtension: ev.isExtension,
        rentalContractAddress: ev.transactionTo,
        ownerHasClaimedAsset: false,
        claimedAt: null,
        isActive: true,
        ...eventFields(ev),
      })

      const previous = await state.get(Rental, currentRentalId)
      if (previous) {
        previous.isActive = false
        state.save(Rental, previous)
      }

      // The two asset-index updates the rent transaction emitted right before this event belong
      // to the rent, not to a cancellation.
      const last = (await count(state, ALL_INDEXES_UPDATES)).value
      const lastAsset = await state.get(IndexesUpdateAssetHistory, last.toString())
      const secondToLastAsset = await state.get(IndexesUpdateAssetHistory, (last - 1n).toString())
      if (lastAsset && secondToLastAsset) {
        lastAsset.type = IndexUpdateEventType.RENT
        secondToLastAsset.type = IndexUpdateEventType.RENT
        state.save(IndexesUpdateAssetHistory, lastAsset)
        state.save(IndexesUpdateAssetHistory, secondToLastAsset)
      }

      state.save(Rental, rental)
      current.value = nextValue
      state.save(RentalsCount, current)

      const all = await count(state, ALL_RENTALS)
      all.value += 1n
      state.save(RentalsCount, all)

      if (!(await state.get(Rentable, ev.contractAddress))) {
        state.save(Rentable, new Rentable({ id: ev.contractAddress }))
      }

      const assetId = `${ev.contractAddress}-${ev.tokenId}`
      const asset = (await state.get(RentalAsset, assetId)) ?? new RentalAsset({ id: assetId })
      asset.contractAddress = toBytes(ev.contractAddress)
      asset.tokenId = ev.tokenId
      asset.lessor = toBytes(ev.lessor)
      asset.isClaimed = false
      asset.claimedAt = null
      state.save(RentalAsset, asset)

      const fee = (await rentalsContract(state)).fee
      const volume = ev.rentalDays * ev.pricePerDay
      const feeCollectorEarnings = (volume * fee) / 1_000_000n

      const dayNumber = ev.timestamp / DAY
      const dayId = dayNumber.toString()
      const day =
        (await state.get(AnalyticsDayData, dayId)) ??
        new AnalyticsDayData({
          id: dayId,
          date: Number(dayNumber * DAY),
          rentals: 0,
          volume: 0n,
          lessorEarnings: 0n,
          feeCollectorEarnings: 0n,
        })
      day.rentals += 1
      day.volume += volume
      day.lessorEarnings += volume - feeCollectorEarnings
      day.feeCollectorEarnings += feeCollectorEarnings
      state.save(AnalyticsDayData, day)

      const total =
        (await state.get(AnalyticsTotalData, ANALYTICS_TOTAL)) ??
        new AnalyticsTotalData({ id: ANALYTICS_TOTAL, rentals: 0, volume: 0n, lessorEarnings: 0n, feeCollectorEarnings: 0n })
      total.rentals += 1
      total.volume += volume
      total.lessorEarnings += volume - feeCollectorEarnings
      total.feeCollectorEarnings += feeCollectorEarnings
      state.save(AnalyticsTotalData, total)
      return
    }
    case 'AssetClaimed': {
      const index = (await count(state, `${ev.contractAddress}-${ev.tokenId}`)).value
      const rental = await state.get(Rental, buildRentalId(ev.contractAddress, ev.tokenId, index))
      if (!rental) {
        state.errors.push(`asset claimed for a rental that does not exist: ${ev.contractAddress} ${ev.tokenId}`)
        return
      }
      rental.isActive = false
      rental.ownerHasClaimedAsset = true
      rental.updatedAt = ev.timestamp
      rental.claimedAt = ev.timestamp
      state.save(Rental, rental)

      const asset = await state.get(RentalAsset, `${ev.contractAddress}-${ev.tokenId}`)
      if (!asset) {
        state.errors.push(`rental asset ${ev.contractAddress}-${ev.tokenId} does not exist`)
        return
      }
      asset.lessor = null
      asset.isClaimed = true
      asset.claimedAt = ev.timestamp
      state.save(RentalAsset, asset)
      return
    }
    case 'ContractIndexUpdated': {
      const id = (await nextIndexesUpdate(state)).value.toString()
      const child = new IndexesUpdateContractHistory({ id, newIndex: ev.newIndex, contractAddress: toBytes(ev.address) })
      state.save(IndexesUpdateContractHistory, child)
      state.save(
        IndexesUpdateHistory,
        new IndexesUpdateHistory({
          id,
          type: IndexUpdateType.CONTRACT,
          date: ev.timestamp,
          sender: ev.sender,
          contractUpdate: child,
          singerUpdate: null,
          assetUpdate: null,
          ...eventFields(ev),
        })
      )
      return
    }
    case 'SignerIndexUpdated': {
      const id = (await nextIndexesUpdate(state)).value.toString()
      const child = new IndexesUpdateSignerHistory({ id, newIndex: ev.newIndex, signer: ev.signer })
      state.save(IndexesUpdateSignerHistory, child)
      state.save(
        IndexesUpdateHistory,
        new IndexesUpdateHistory({
          id,
          type: IndexUpdateType.SIGNER,
          date: ev.timestamp,
          sender: ev.sender,
          contractUpdate: null,
          singerUpdate: child,
          assetUpdate: null,
          ...eventFields(ev),
        })
      )
      return
    }
    case 'AssetIndexUpdated': {
      const id = (await nextIndexesUpdate(state)).value.toString()
      const child = new IndexesUpdateAssetHistory({
        id,
        type: IndexUpdateEventType.CANCEL,
        newIndex: ev.newIndex,
        signer: ev.signer,
        tokenId: ev.tokenId,
        contractAddress: ev.contractAddress,
      })
      state.save(IndexesUpdateAssetHistory, child)
      state.save(
        IndexesUpdateHistory,
        new IndexesUpdateHistory({
          id,
          type: IndexUpdateType.ASSET,
          date: ev.timestamp,
          sender: ev.sender,
          contractUpdate: null,
          singerUpdate: null,
          assetUpdate: child,
          ...eventFields(ev),
        })
      )
      return
    }
    case 'FeeUpdated': {
      const contract = await rentalsContract(state)
      contract.fee = ev.to
      state.save(RentalsContract, contract)
      return
    }
    case 'RentableUpdateOperator': {
      // The subgraph only listens to a contract after its first rental (the Rentable template).
      if (!(await state.get(Rentable, ev.contractAddress))) return
      const index = (await count(state, `${ev.contractAddress}-${ev.tokenId}`)).value
      const rental = await state.get(Rental, buildRentalId(ev.contractAddress, ev.tokenId, index))
      if (!rental) return
      rental.operator = ev.operator
      rental.updatedAt = ev.timestamp
      state.save(Rental, rental)
      return
    }
  }
}
