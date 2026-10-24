import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as factoryAbi from '../../abi/VestingFactory'
import * as v1Abi from '../../abi/TokenVesting'
import * as v2Abi from '../../abi/PeriodicTokenVesting'
import { toHex } from '../../common/hex'
import { Vesting } from '../../model'
import { VESTING_NETWORKS } from './config'
import { decodeVestingLog, VestingEvent } from './events'
import { RpcConnectionError, RpcError } from '@subsquid/rpc-client'
import { createVestingReader, reverted } from './reader'
import { applyVestingEvent, VestingFields, VestingReader, VestingState } from './state'

const network = VESTING_NETWORKS['ethereum-mainnet']
const VESTING = '0x02d2c06c1b0e1c2a6f9e4d6e8f1a2b3c4d5e6f70'
const OWNER = '0x' + '0a'.repeat(20)
const word = (address: string) => '0x' + '0'.repeat(24) + address.slice(2)
const uint = (n: bigint) => '0x' + n.toString(16).padStart(64, '0')
const ETH = 10n ** 18n

const v1Fields: VestingFields = {
  version: 1,
  duration: 31536000n,
  cliff: 1659707700n,
  beneficiary: OWNER,
  revoked: false,
  revocable: true,
  released: 0n,
  start: 1657115700n,
  periodDuration: 0n,
  vestedPerPeriod: [],
  paused: false,
  pausable: false,
  stop: 0n,
  linear: true,
  token: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
  owner: OWNER,
  total: 35000n,
}

function setup(fields: VestingFields = v1Fields) {
  const reads: [string, number][] = []
  const reader: VestingReader = {
    async read(vesting, blockNumber) {
      reads.push([vesting, blockNumber])
      return fields
    },
  }
  const state = new VestingState({ get: async () => undefined })
  const apply = (ev: VestingEvent) => applyVestingEvent(state, ev, reader)
  return { state, reads, apply }
}

const at = (blockNumber: number, timestamp: number) => ({ blockNumber, timestamp: BigInt(timestamp) })

test('the factory creates a vesting, read at its block, with the subgraph\'s fields', async () => {
  const log = { address: network.factory, topics: [factoryAbi.events.VestingCreated.topic, word(VESTING)], data: '0x' + '00'.repeat(32) }
  const ev = decodeVestingLog(log, at(15000000, 1657000000), network)
  assert.deepEqual(ev, { ...at(15000000, 1657000000), kind: 'VestingCreated', vesting: VESTING })

  const { state, reads, apply } = setup()
  await apply(ev!)
  assert.deepEqual(reads, [[VESTING, 15000000]])
  const vesting = state.vestings.get(VESTING)!
  assert.equal(toHex(vesting.beneficiary), OWNER)
  assert.equal(vesting.total, 35000n)
  assert.equal(vesting.revokeTimestamp, null)
  assert.deepEqual(vesting.vestedPerPeriod, [])
})

test('version 2 periods are kept as decimal strings, as the subgraph answers its BigInt list', async () => {
  const { state, apply } = setup({ ...v1Fields, version: 2, vestedPerPeriod: [1562n, 1563n], total: 3125n })
  await apply({ ...at(1, 1), kind: 'VestingCreated', vesting: VESTING })
  assert.deepEqual(state.vestings.get(VESTING)!.vestedPerPeriod, ['1562', '1563'])
})

test('a release adds whole tokens and logs them by timestamp; a version 1 one adds the running total it emits', async () => {
  const { state, apply } = setup()
  await apply({ ...at(1, 100), kind: 'VestingCreated', vesting: VESTING })

  const v1 = decodeVestingLog({ address: VESTING, topics: [v1Abi.events.Released.topic], data: uint(1500n * ETH + ETH / 2n) }, at(2, 200), network)
  assert.deepEqual(v1, { ...at(2, 200), kind: 'ReleasedV1', vesting: VESTING, amount: 1500n * ETH + ETH / 2n })
  await apply(v1!)
  // The contract's running total, 2000 tokens, added as if it were the amount released.
  await apply({ ...at(3, 300), kind: 'ReleasedV1', vesting: VESTING, amount: 2000n * ETH })

  const vesting = state.vestings.get(VESTING)!
  assert.equal(vesting.released, 3500n)
  assert.deepEqual(
    [...state.releaseLogs.values()].map((l) => [l.id, l.timestamp, l.amount]),
    [
      [`${VESTING}-200`, 200n, 1500n],
      [`${VESTING}-300`, 300n, 2000n],
    ]
  )
})

test('two releases of one vesting in the same block keep the last log, as the subgraph does, and add both', async () => {
  const { state, apply } = setup()
  await apply({ ...at(1, 100), kind: 'VestingCreated', vesting: VESTING })
  const released = (amount: bigint) =>
    decodeVestingLog({ address: VESTING, topics: [v2Abi.events.Released.topic, word(OWNER)], data: uint(amount * ETH) }, at(2, 200), network)!
  await apply(released(10n))
  await apply(released(5n))
  assert.equal(state.vestings.get(VESTING)!.released, 15n)
  assert.deepEqual([...state.releaseLogs.values()].map((l) => l.amount), [5n])
})

test('pauses, unpauses and revocations update the vesting and log the pauses', async () => {
  const { state, apply } = setup()
  await apply({ ...at(1, 100), kind: 'VestingCreated', vesting: VESTING })
  for (const [topic, block] of [
    [v2Abi.events.Paused.topic, 2],
    [v2Abi.events.Unpaused.topic, 3],
    [v2Abi.events.Paused.topic, 4],
    [v1Abi.events.Revoked.topic, 5],
  ] as const) {
    await apply(decodeVestingLog({ address: VESTING, topics: [topic], data: topic === v1Abi.events.Revoked.topic ? '0x' : word(OWNER) }, at(block, block * 100), network)!)
  }
  const vesting = state.vestings.get(VESTING)!
  assert.equal(vesting.paused, true)
  assert.equal(vesting.revoked, true)
  assert.equal(vesting.revokeTimestamp, 500n)
  assert.deepEqual(
    [...state.pausedLogs.values()].map((l) => [l.id, l.eventType]),
    [
      [`${VESTING}-200-Paused`, 'Paused'],
      [`${VESTING}-300-Unpaused`, 'Unpaused'],
      [`${VESTING}-400-Paused`, 'Paused'],
    ]
  )
})

test('events of contracts the factory did not create are left out', async () => {
  const { state, apply } = setup()
  await apply({ ...at(2, 200), kind: 'Paused', vesting: '0x' + 'ee'.repeat(20) })
  assert.equal(state.vestings.size, 0)
  assert.equal(state.pausedLogs.size, 0)
})

test('a vesting created in an earlier batch is read from the store', async () => {
  const stored = new Vesting({ id: VESTING, released: 1n, paused: false })
  const state = new VestingState({ get: async (id) => (id === VESTING ? stored : undefined) })
  await applyVestingEvent(state, { ...at(9, 900), kind: 'ReleasedV2', vesting: VESTING, amount: 2n * ETH }, { read: async () => v1Fields })
  assert.equal(stored.released, 3n)
})

test('logs of the factory other than creations, and of unrelated events, are not vesting events', () => {
  assert.equal(decodeVestingLog({ address: network.factory, topics: [v1Abi.events.Revoked.topic], data: '0x' }, at(1, 1), network), undefined)
  assert.equal(decodeVestingLog({ address: VESTING, topics: ['0x' + '12'.repeat(32)], data: '0x' }, at(1, 1), network), undefined)
})

test('an event of another contract with a vesting event\'s topic and another layout is left out, not thrown', () => {
  // Released(uint256) with the amount indexed: no data to decode.
  assert.equal(decodeVestingLog({ address: '0x' + 'ee'.repeat(20), topics: [v1Abi.events.Released.topic, uint(1n)], data: '0x' }, at(1, 1), network), undefined)
  // Released(address,uint256) with the address not indexed: one topic short.
  assert.equal(decodeVestingLog({ address: '0x' + 'ee'.repeat(20), topics: [v2Abi.events.Released.topic], data: word(OWNER) + uint(1n).slice(2) }, at(1, 1), network), undefined)
})

test('only a revert the node reports makes a contract version 2', () => {
  assert.equal(reverted(new RpcError({ code: 3, message: 'execution reverted' })), true)
  assert.equal(reverted(new RpcError({ code: -32000, message: 'execution reverted' })), true)
  assert.equal(reverted(new RpcConnectionError('socket hang up while reverting')), false)
  assert.equal(reverted(new Error('execution reverted')), false)
})

test('the reader tells the versions apart by duration(), and lets other failures through', async () => {
  const calls: string[] = []
  const answer = (data: string) => async (method: string, params?: unknown[]) => {
    const call = (params as [{ data: string }])[0].data.slice(0, 10)
    calls.push(call)
    if (call === v1Abi.functions.duration.selector) {
      if (data === 'v2') throw new RpcError({ code: 3, message: 'execution reverted' })
      if (data === 'down') throw new RpcConnectionError('socket hang up')
    }
    return '0x' + '0'.repeat(64)
  }
  const v2 = await createVestingReader(network, { call: answer('v2') as never }).read(VESTING, 1)
  assert.equal(v2.version, 2)
  assert.ok(calls.includes(v2Abi.functions.getVestedPerPeriod.selector) || calls.length > 1)
  const v1 = await createVestingReader(network, { call: answer('v1') as never }).read(VESTING, 1)
  assert.equal(v1.version, 1)
  await assert.rejects(createVestingReader(network, { call: answer('down') as never }).read(VESTING, 1), RpcConnectionError)
})
