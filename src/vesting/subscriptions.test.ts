import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VestingNetwork, VESTING_NETWORKS } from './config'
import { VESTING_TOPICS } from './events'
import { vestingLogRequests } from './subscriptions'

const network: VestingNetwork = {
  ...VESTING_NETWORKS['ethereum-mainnet'],
  factoryStartBlock: 100,
  snapshot: { height: 1000, addresses: ['0x' + '01'.repeat(20)] },
}
const ranges = (from: number, n: VestingNetwork = network) => vestingLogRequests(n, from).map((r) => [r.where.address === undefined ? 'topic' : r.where.address[0] === n.factory ? 'factory' : 'snapshot', r.range])

test('from the factory: its creations, the snapshot by address up to its height, and any contract by topic past it', () => {
  assert.deepEqual(ranges(0), [
    ['factory', { from: 100 }],
    ['snapshot', { from: 100, to: 1000 }],
    ['topic', { from: 1001 }],
  ])
  assert.deepEqual(vestingLogRequests(network, 0)[2].where, { topic0: VESTING_TOPICS })
})

test('from a block inside the snapshot, the snapshot is read from there', () => {
  assert.deepEqual(ranges(500)[1], ['snapshot', { from: 500, to: 1000 }])
})

test('from a block past the snapshot, the snapshot is not read, rather than in an empty range', () => {
  assert.deepEqual(ranges(5000), [
    ['factory', { from: 5000 }],
    ['topic', { from: 5000 }],
  ])
  assert.deepEqual(ranges(1001).map(([kind]) => kind), ['factory', 'topic'])
  assert.deepEqual(ranges(1000).map(([kind]) => kind), ['factory', 'snapshot', 'topic'])
})

test('an empty snapshot is not read', () => {
  assert.deepEqual(
    ranges(0, { ...network, snapshot: { height: 0, addresses: [] } }),
    [
      ['factory', { from: 100 }],
      ['topic', { from: 100 }],
    ]
  )
})
