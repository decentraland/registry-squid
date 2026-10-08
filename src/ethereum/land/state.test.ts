import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyLandEvent, LandState } from './state'
import { LandEvent, EventMeta } from './events'
import { encodeTokenId, parcelId } from '../../common/land'
import { toHex } from '../../common/hex'

const LAND = '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d'
const ESTATE = '0x959e104e1a4db6317fa58f8295f586e1a978c297'
const ALICE = '0x00000000000000000000000000000000000a11ce'
const BOB = '0x0000000000000000000000000000000000000b0b'
const CAROL = '0x00000000000000000000000000000000000ca201'

let logIndex = 0
function meta(blockNumber: number, address = LAND): EventMeta {
  return { blockNumber, timestamp: 1_700_000_000n + BigInt(blockNumber), logIndex: logIndex++, transactionHash: '0xtx', address }
}

function apply(state: LandState, ev: LandEvent) {
  applyLandEvent(state, ev)
}

test('a parcel transfer sets the owner, clears operators and writes three history rows', () => {
  const state = new LandState(ESTATE)
  const tokenId = encodeTokenId(-5n, -10n)
  apply(state, { ...meta(100), kind: 'ParcelApproval', owner: ALICE, operator: BOB, tokenId })
  apply(state, { ...meta(100), kind: 'ParcelUpdateOperator', tokenId, operator: CAROL })
  apply(state, { ...meta(101), kind: 'ParcelTransfer', to: BOB, tokenId })

  const p = state.parcels.get(parcelId(tokenId))!
  assert.equal(p.x, -5n)
  assert.equal(p.y, -10n)
  assert.equal(p.owner?.id, BOB)
  assert.equal(p.operator, null)
  assert.equal(p.updateOperator, null)
  assert.equal(state.owners.length, 1)
  assert.equal(state.operators.length, 2) // the approval, then the transfer's reset
  assert.equal(state.updateOperators.length, 2)
  assert.match(state.owners[0].id, /^101-\d+-Owner$/)
  assert.equal(state.operators[1].address, null)
})

test('the authorization log keeps every event and the state keeps the latest', () => {
  const state = new LandState(ESTATE)
  const first = meta(200)
  apply(state, { ...first, kind: 'Authorization', type: 'UpdateManager', owner: ALICE, operator: BOB, approved: true })
  apply(state, { ...meta(201), kind: 'Authorization', type: 'UpdateManager', owner: ALICE, operator: BOB, approved: false })

  assert.equal(state.authorizations.length, 2)
  assert.equal(state.authorizations[0].id, `200-${first.logIndex}-UpdateManager`)
  assert.equal(state.authorizations[0].timestamp, first.timestamp * 1_000_000n + BigInt(first.logIndex))
  const current = state.authorizationStates.get(`${LAND}-${ALICE}-${BOB}-UpdateManager`)!
  assert.equal(current.isApproved, false)
  assert.equal(current.blockNumber, 201)
})

test('parcel metadata merges like graph-node: a missing field keeps its old value', () => {
  const state = new LandState(ESTATE)
  const tokenId = encodeTokenId(1n, 2n)
  apply(state, { ...meta(300), kind: 'ParcelTransfer', to: ALICE, tokenId })
  apply(state, { ...meta(301), kind: 'ParcelUpdate', tokenId, data: '0,"Name","Description",' })
  apply(state, { ...meta(302), kind: 'ParcelUpdate', tokenId, data: '0,"New name"' })
  apply(state, { ...meta(303), kind: 'ParcelUpdate', tokenId, data: 'not csv' })

  const d = state.datas.get(parcelId(tokenId))!
  assert.equal(d.name, 'New name')
  assert.equal(d.description, 'Description')
  assert.equal(state.parcels.get(parcelId(tokenId))!.data?.id, parcelId(tokenId))
})

test('estates: create, add and remove land, with history that keeps the estate id', () => {
  const state = new LandState(ESTATE)
  const landA = encodeTokenId(10n, 10n)
  const landB = encodeTokenId(10n, 11n)
  apply(state, { ...meta(400), kind: 'ParcelTransfer', to: ALICE, tokenId: landA })
  apply(state, { ...meta(400), kind: 'ParcelTransfer', to: ALICE, tokenId: landB })
  apply(state, { ...meta(401, ESTATE), kind: 'EstateTransfer', to: ALICE, tokenId: 7n })
  apply(state, { ...meta(401, ESTATE), kind: 'CreateEstate', owner: ALICE, tokenId: 7n, data: '0,"My estate",' })
  apply(state, { ...meta(401, ESTATE), kind: 'AddLand', estateTokenId: 7n, landTokenId: landA })
  apply(state, { ...meta(401, ESTATE), kind: 'AddLand', estateTokenId: 7n, landTokenId: landB })
  const remove = meta(402, ESTATE)
  apply(state, { ...remove, kind: 'RemoveLand', estateTokenId: 7n, landTokenId: landB, destinatary: BOB })

  const estate = state.estates.get('7')!
  assert.equal(estate.size, 1)
  assert.equal(estate.owner.id, ALICE)
  assert.equal(estate.data?.name, 'My estate')
  assert.equal(state.parcels.get(parcelId(landA))!.owner?.id, ESTATE)
  assert.equal(state.parcels.get(parcelId(landA))!.estate?.id, '7')
  assert.equal(state.parcels.get(parcelId(landB))!.owner?.id, BOB)
  assert.equal(state.parcels.get(parcelId(landB))!.estate, null)

  const removal = state.estateHistories[2]
  assert.equal(removal.id, `402-${remove.logIndex}-RemoveLand-7`)
  assert.equal(removal.estateId, null)
  assert.equal(removal.estateTokenId, '7')
  assert.equal(removal.eventName, 'RemoveLand')
})

test('events for an unknown estate are skipped with a warning, not invented', () => {
  const state = new LandState(ESTATE)
  apply(state, { ...meta(500, ESTATE), kind: 'AddLand', estateTokenId: 99n, landTokenId: encodeTokenId(0n, 0n) })
  apply(state, { ...meta(500, ESTATE), kind: 'EstateUpdateOperator', tokenId: 99n, operator: BOB })
  assert.equal(state.estates.size, 0)
  assert.equal(state.parcels.size, 0)
  assert.equal(state.warnings.length, 2)
})

test('wallets are created for every owner reference, the estate registry included', () => {
  const state = new LandState(ESTATE)
  apply(state, { ...meta(600, ESTATE), kind: 'EstateTransfer', to: ALICE, tokenId: 8n })
  apply(state, { ...meta(600, ESTATE), kind: 'CreateEstate', owner: ALICE, tokenId: 8n, data: '' })
  apply(state, { ...meta(600, ESTATE), kind: 'AddLand', estateTokenId: 8n, landTokenId: encodeTokenId(3n, 3n) })
  assert.deepEqual([...state.newWallets].sort(), [ALICE, ESTATE].sort())
  assert.equal(toHex(state.wallets.get(ESTATE)!.address), ESTATE)
})
