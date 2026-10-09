import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyRentalsEvent, RentalsLoader, RentalsState } from './state'
import { RentalsEvent } from './events'
import { EventMeta } from '../land/events'
import {
  AnalyticsDayData,
  AnalyticsTotalData,
  IndexesUpdateAssetHistory,
  IndexesUpdateHistory,
  IndexUpdateEventType,
  Rentable,
  Rental,
  RentalAsset,
  RentalsCount,
} from '../../model'
import { toHex } from '../../common/hex'

const RENTALS = '0x3a1469499d0be105d4f77045ca403a5f6dc2f3f5'
const LAND = '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d'
const LESSOR = '0x00000000000000000000000000000000000a11ce'
const TENANT = '0x0000000000000000000000000000000000000b0b'

const emptyLoader: RentalsLoader = { get: async () => undefined }

let logIndex = 0
function meta(blockNumber: number, timestamp = 1_700_000_000n): EventMeta {
  return { blockNumber, timestamp, logIndex: logIndex++, transactionHash: '0xtx', address: RENTALS }
}

function rented(m: EventMeta, overrides: Partial<Extract<RentalsEvent, { kind: 'AssetRented' }>> = {}): RentalsEvent {
  return {
    ...m,
    kind: 'AssetRented',
    contractAddress: LAND,
    tokenId: 42n,
    lessor: LESSOR,
    tenant: TENANT,
    operator: TENANT,
    rentalDays: 3n,
    pricePerDay: 10n ** 18n,
    isExtension: false,
    sender: TENANT,
    signature: '0xabcd',
    transactionTo: RENTALS,
    ...overrides,
  }
}

async function get<E extends { id: string }>(state: RentalsState, cls: new (p?: Partial<E>) => E, id: string) {
  return (await state.get(cls, id))!
}

test('a rental creates the rental, its asset, the counters and the analytics', async () => {
  const state = new RentalsState(emptyLoader)
  await applyRentalsEvent(state, { ...meta(1), kind: 'FeeUpdated', to: 25_000n })
  const m = meta(2)
  await applyRentalsEvent(state, rented(m))

  const rental = await get(state, Rental, `${LAND}:42:1`)
  assert.equal(rental.isActive, true)
  assert.equal(rental.endsAt, m.timestamp + 3n * 86400n)
  assert.equal(rental.rentalContractAddress, RENTALS)
  assert.equal((await get(state, RentalsCount, `${LAND}-42`)).value, 1n)
  assert.equal((await get(state, RentalsCount, 'all-rentals')).value, 1n)
  assert.ok(await state.get(Rentable, LAND))

  const asset = await get(state, RentalAsset, `${LAND}-42`)
  assert.equal(toHex(asset.lessor!), LESSOR)
  assert.equal(asset.isClaimed, false)

  // volume = 3 days * 1 MANA; fee = 2.5%
  const volume = 3n * 10n ** 18n
  const fee = (volume * 25_000n) / 1_000_000n
  const day = await get(state, AnalyticsDayData, (m.timestamp / 86400n).toString())
  assert.equal(day.date, Number((m.timestamp / 86400n) * 86400n))
  assert.equal(day.rentals, 1)
  assert.equal(day.feeCollectorEarnings, fee)
  assert.equal(day.lessorEarnings, volume - fee)
  assert.equal((await get(state, AnalyticsTotalData, 'analytics-total-data')).volume, volume)
})

test('a second rental of the same asset deactivates the first', async () => {
  const state = new RentalsState(emptyLoader)
  await applyRentalsEvent(state, rented(meta(1)))
  await applyRentalsEvent(state, rented(meta(2), { isExtension: true }))
  assert.equal((await get(state, Rental, `${LAND}:42:1`)).isActive, false)
  assert.equal((await get(state, Rental, `${LAND}:42:2`)).isActive, true)
})

test('the two asset-index updates right before a rental are marked as RENT', async () => {
  const state = new RentalsState(emptyLoader)
  const assetUpdate = (m: EventMeta): RentalsEvent => ({
    ...m,
    kind: 'AssetIndexUpdated',
    signer: LESSOR,
    contractAddress: LAND,
    tokenId: 42n,
    newIndex: 1n,
    sender: TENANT,
  })
  await applyRentalsEvent(state, assetUpdate(meta(1)))
  await applyRentalsEvent(state, assetUpdate(meta(2)))
  await applyRentalsEvent(state, assetUpdate(meta(2)))
  await applyRentalsEvent(state, rented(meta(2)))

  assert.equal((await get(state, IndexesUpdateAssetHistory, '1')).type, IndexUpdateEventType.CANCEL)
  assert.equal((await get(state, IndexesUpdateAssetHistory, '2')).type, IndexUpdateEventType.RENT)
  assert.equal((await get(state, IndexesUpdateAssetHistory, '3')).type, IndexUpdateEventType.RENT)
  assert.equal((await get(state, IndexesUpdateHistory, '3')).assetUpdate?.id, '3')
})

test('claiming ends the rental and frees the asset', async () => {
  const state = new RentalsState(emptyLoader)
  await applyRentalsEvent(state, rented(meta(1)))
  const claim = meta(2, 1_700_100_000n)
  await applyRentalsEvent(state, { ...claim, kind: 'AssetClaimed', contractAddress: LAND, tokenId: 42n })

  const rental = await get(state, Rental, `${LAND}:42:1`)
  assert.equal(rental.isActive, false)
  assert.equal(rental.ownerHasClaimedAsset, true)
  assert.equal(rental.claimedAt, claim.timestamp)
  const asset = await get(state, RentalAsset, `${LAND}-42`)
  assert.equal(asset.lessor, null)
  assert.equal(asset.isClaimed, true)
})

test('operator updates only apply once the contract has been rented from', async () => {
  const state = new RentalsState(emptyLoader)
  const update = (m: EventMeta): RentalsEvent => ({ ...m, kind: 'RentableUpdateOperator', contractAddress: LAND, tokenId: 42n, operator: LESSOR })
  await applyRentalsEvent(state, update(meta(1)))
  assert.equal(state.touched.size, 0)

  await applyRentalsEvent(state, rented(meta(2)))
  await applyRentalsEvent(state, update(meta(3)))
  assert.equal((await get(state, Rental, `${LAND}:42:1`)).operator, LESSOR)
})

test('a rental without a transaction recipient is skipped, as the subgraph does', async () => {
  const state = new RentalsState(emptyLoader)
  await applyRentalsEvent(state, rented(meta(1), { transactionTo: null }))
  assert.equal(state.touched.size, 0)
  assert.equal(state.errors.length, 1)
})
