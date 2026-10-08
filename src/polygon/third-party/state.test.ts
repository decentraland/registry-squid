import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyThirdPartyEvent, asciiLowerCase, ThirdPartyState } from './state'
import { ThirdPartyEvent } from './events'
import { EventMeta } from '../../ethereum/land/events'
import { Curation, MetadataType, Receipt, ThirdParty, ThirdPartyCount, ThirdPartyMetadata, ThirdPartyRootHistory } from '../../model'

const REGISTRY = '0x1c436c1efb4608dffdc8bace99d2b03c314f3348'
const ID = 'urn:decentraland:matic:collections-thirdparty:cryptopunks'
const M1 = '0x0000000000000000000000000000000000000001'
const M2 = '0x0000000000000000000000000000000000000002'
const M3 = '0x0000000000000000000000000000000000000003'
const ROOT = '0x44af6f9a430f933646e5c3b6f34d22c1a1c24f46b6996b5ddd7e8efd08e8634c'

let logIndex = 0
function meta(blockNumber: number): EventMeta {
  return { blockNumber, timestamp: 1_700_000_000n, logIndex: logIndex++, transactionHash: '0xtx', address: REGISTRY }
}

function added(
  m: EventMeta,
  metadata = 'tp:1:Crypto Punks:The ORIGINAL punks:mainnet-0xABC;Polygon-0xdef'
): Extract<ThirdPartyEvent, { kind: 'ThirdPartyAdded' }> {
  return {
    ...m,
    kind: 'ThirdPartyAdded',
    thirdPartyId: ID,
    metadata,
    resolver: 'https://api.example.com',
    isApproved: true,
    managers: [M1, M2],
    itemSlots: 10n,
    isProgrammatic: false,
  }
}

const loader = { get: async () => undefined }

test('adding a third party mirrors the subgraph, managers reversed and unapproved until it has a root', async () => {
  const state = new ThirdPartyState(loader)
  await applyThirdPartyEvent(state, added(meta(1)))

  const tp = (await state.get(ThirdParty, ID))!
  assert.deepEqual(tp.managers, [M2, M1])
  assert.equal(tp.isApproved, false)
  assert.equal(tp.root, '')
  assert.equal(tp.searchName, 'Crypto Punks')
  assert.equal(tp.searchText, 'crypto punks the original punks')
  const metadata = (await state.get(ThirdPartyMetadata, ID))!
  assert.deepEqual(
    metadata.contracts!.map((c) => [c.id, c.network, c.address]),
    [
      ['mainnet-0xabc', 'mainnet', '0xabc'],
      ['polygon-0xdef', 'polygon', '0xdef'],
    ]
  )
  assert.equal(tp.metadata.type, MetadataType.third_party_v1)
  assert.equal((await state.get(ThirdPartyCount, 'all'))!.thirdPartyTotal, 1n)
})

test('an invalid URN is ignored', async () => {
  const state = new ThirdPartyState(loader)
  await applyThirdPartyEvent(state, { ...added(meta(1)), thirdPartyId: 'urn:decentraland:matic:collections-v2:x' })
  assert.equal(state.touched.size, 0)
})

test('reviews set the root and approval, and every review lands in the root history', async () => {
  const state = new ThirdPartyState(loader)
  await applyThirdPartyEvent(state, added(meta(1)))
  await applyThirdPartyEvent(state, { ...meta(2), kind: 'ThirdPartyReviewed', thirdPartyId: ID, value: true })
  assert.equal((await state.get(ThirdParty, ID))!.isApproved, false) // still no root

  const withRoot = meta(3)
  await applyThirdPartyEvent(state, { ...withRoot, kind: 'ThirdPartyReviewedWithRoot', thirdPartyId: ID, root: ROOT, isApproved: true })
  const tp = (await state.get(ThirdParty, ID))!
  assert.equal(tp.root, ROOT)
  assert.equal(tp.isApproved, true)

  await applyThirdPartyEvent(state, { ...meta(4), kind: 'ThirdPartyReviewed', thirdPartyId: ID, value: false })
  const history = state.entitiesToSave(ThirdPartyRootHistory)
  assert.deepEqual(
    history.map((h) => [h.blockNumber, h.root, h.isApproved]),
    [
      [2, '', false],
      [3, ROOT, true],
      [4, ROOT, false],
    ]
  )
  assert.equal(history[1].id, `3-${withRoot.logIndex}`)
})

test('updates add and remove managers in place and keep the last good metadata', async () => {
  const state = new ThirdPartyState(loader)
  await applyThirdPartyEvent(state, added(meta(1)))
  await applyThirdPartyEvent(state, {
    ...meta(2),
    kind: 'ThirdPartyUpdated',
    thirdPartyId: ID,
    metadata: 'not:valid',
    resolver: 'ipfs://nope',
    managers: [M3, M2],
    managerValues: [true, false],
    itemSlots: 5n,
  })
  const tp = (await state.get(ThirdParty, ID))!
  assert.deepEqual(tp.managers, [M1, M3])
  assert.equal(tp.maxItems, 15n)
  assert.equal(tp.resolver, null)
  assert.equal(tp.metadata.type, MetadataType.undefined)
  assert.equal(tp.searchName, 'Crypto Punks')
})

test('consuming slots records the curation, the receipt and the counters', async () => {
  const state = new ThirdPartyState(loader)
  await applyThirdPartyEvent(state, added(meta(1)))
  const consume = (m: EventMeta, hash: string): ThirdPartyEvent => ({
    ...m,
    kind: 'ItemSlotsConsumed',
    thirdPartyId: ID,
    qty: 3n,
    signer: M1,
    messageHash: hash,
    sender: M2,
  })
  await applyThirdPartyEvent(state, consume(meta(2), '0xaa'))
  await applyThirdPartyEvent(state, consume(meta(3), '0xbb'))

  assert.equal((await state.get(ThirdParty, ID))!.consumedSlots, 6n)
  assert.equal((await state.get(Curation, M2))!.qty, 6n)
  assert.equal((await state.get(Receipt, '0xbb'))!.curation.id, M2)
  const count = (await state.get(ThirdPartyCount, 'all'))!
  assert.equal(count.curationTotal, 1n)
  assert.equal(count.receiptTotal, 2n)
})

test('metadata without linked contracts reads as an empty list, as graph-node returns it', async () => {
  const state = new ThirdPartyState(loader)
  await applyThirdPartyEvent(state, added(meta(1), 'tp:1:DELETED:deleted'))
  assert.deepEqual((await state.get(ThirdPartyMetadata, ID))!.contracts, [])
})

test('linked contracts read sorted by id and once each, as graph-node resolves references', async () => {
  const state = new ThirdPartyState(loader)
  await applyThirdPartyEvent(state, added(meta(1), 'tp:1:Name:Description:polygon-0xbbb;mainnet-0xccc;polygon-0xaaa;Polygon-0xBBB'))
  assert.deepEqual(
    (await state.get(ThirdPartyMetadata, ID))!.contracts!.map((c) => c.id),
    ['mainnet-0xccc', 'polygon-0xaaa', 'polygon-0xbbb']
  )
})

test('NUL characters are stripped from stored strings, ids included, as graph-node does', async () => {
  const state = new ThirdPartyState(loader)
  await applyThirdPartyEvent(state, {
    ...added(meta(1), 'tp:1:Pun\u0000ks:De\u0000sc:polygon-0xa\u0000aa'),
    thirdPartyId: `${ID}\u0000`,
    resolver: 'https://api.example.com/\u0000',
  })
  const tp = (await state.get(ThirdParty, ID))!
  assert.equal(tp.rawMetadata, 'tp:1:Punks:Desc:polygon-0xaaa')
  assert.equal(tp.resolver, 'https://api.example.com/')
  assert.equal(tp.searchText, 'punks desc')
  assert.deepEqual((await state.get(ThirdPartyMetadata, ID))!.contracts!.map((c) => c.id), ['polygon-0xaaa'])

  await applyThirdPartyEvent(state, { ...meta(2), kind: 'ThirdPartyItemSlotsBought', thirdPartyId: `${ID}\u0000`, value: 5n })
  assert.equal(tp.maxItems, 15n)
})

test('only ASCII letters are lowercased, as the subgraph helper does', () => {
  assert.equal(asciiLowerCase('ÉCOLE Punks'), 'École punks')
})
