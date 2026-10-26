import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as v1Abi from '../abi/TokenVesting'
import * as v2Abi from '../abi/PeriodicTokenVesting'
import { RpcConnectionError, RpcError } from '@subsquid/rpc-client'
import { VESTING_NETWORKS } from './config'
import { createVestingReader, deterministic, reverted } from './reader'

const network = VESTING_NETWORKS['ethereum-mainnet']
const VESTING = '0x02d2c06c1b0e1c2a6f9e4d6e8f1a2b3c4d5e6f70'
const OWNER = '0x' + '0a'.repeat(20)
const ETH = 10n ** 18n

test('only a revert the node reports makes a contract version 2', () => {
  assert.equal(reverted(new RpcError({ code: 3, message: 'execution reverted' })), true)
  assert.equal(reverted(new RpcError({ code: -32000, message: 'execution reverted' })), true)
  assert.equal(reverted(new RpcConnectionError('socket hang up while reverting')), false)
  assert.equal(reverted(new Error('execution reverted')), false)
})

const pad = (hex: string) => hex.replace(/^0x/, '').padStart(64, '0')
const encodeUint = (n: bigint) => pad(n.toString(16))
const encodeAddress = (a: string) => pad(a)
const encodeBool = (b: boolean) => encodeUint(b ? 1n : 0n)
const encodeUints = (list: bigint[]) => encodeUint(32n) + encodeUint(BigInt(list.length)) + list.map(encodeUint).join('')
const TOKEN = '0x0f5d2fb29fb7d3cfee444a200298f468908cc942'
const BENEFICIARY = '0x' + 'be'.repeat(20)
const BLOCK = { height: 15000000, hash: '0x' + 'ab'.repeat(32) }

/**
 * An RPC that answers each function by its selector, and records the block every call is made at. The
 * node holds the block unless `blockHeld` says otherwise.
 */
function fakeRpc(answers: Record<string, string | Error>, blockHeld = true) {
  const blocks: unknown[] = []
  const rpc = {
    async call(method: string, params?: unknown[]) {
      if (method === 'eth_getBlockByHash') return blockHeld ? { hash: (params as string[])[0] } : null
      assert.equal(method, 'eth_call')
      const [{ data }, block] = params as [{ data: string }, unknown]
      blocks.push(block)
      const answer = answers[data.slice(0, 10)]
      if (answer instanceof Error) throw answer
      return answer === undefined ? '0x' : '0x' + answer
    },
  }
  return { rpc: rpc as never, blocks }
}

const revert = () => new RpcError({ code: 3, message: 'execution reverted' })

test('a version 1 contract is read with its hardcoded total, whole tokens, and a linear schedule', async () => {
  const vesting = Object.keys(network.v1Totals)[0]
  const { rpc, blocks } = fakeRpc({
    [v1Abi.functions.duration.selector]: encodeUint(31536000n),
    [v1Abi.functions.token.selector]: encodeAddress(TOKEN),
    [v1Abi.functions.owner.selector]: encodeAddress(OWNER),
    [v1Abi.functions.beneficiary.selector]: encodeAddress(BENEFICIARY),
    [v1Abi.functions.revoked.selector]: encodeBool(false),
    [v1Abi.functions.revocable.selector]: encodeBool(true),
    [v1Abi.functions.released.selector]: encodeUint(1500n * ETH + ETH / 2n),
    [v1Abi.functions.start.selector]: encodeUint(1600000000n),
    [v1Abi.functions.cliff.selector]: encodeUint(1610000000n),
  })
  const fields = await createVestingReader(network, rpc).read(vesting, BLOCK)
  assert.deepEqual(fields, {
    version: 1,
    token: TOKEN,
    owner: OWNER,
    beneficiary: BENEFICIARY,
    revoked: false,
    revocable: true,
    released: 1500n,
    start: 1600000000n,
    cliff: 1610000000n,
    periodDuration: 0n,
    vestedPerPeriod: [],
    duration: 31536000n,
    paused: false,
    pausable: false,
    stop: 0n,
    linear: true,
    total: BigInt(network.v1Totals[vesting]),
  })
  // Every call at the block of that hash, not at its height.
  assert.ok(blocks.length > 0 && blocks.every((block) => JSON.stringify(block) === JSON.stringify({ blockHash: BLOCK.hash })))
})

test('a version 2 contract, which reverts duration(), is read with an absolute cliff, a duration of its periods and their total', async () => {
  const { rpc } = fakeRpc({
    [v1Abi.functions.duration.selector]: revert(),
    [v2Abi.functions.getToken.selector]: encodeAddress(TOKEN),
    [v2Abi.functions.owner.selector]: encodeAddress(OWNER),
    [v2Abi.functions.getBeneficiary.selector]: encodeAddress(BENEFICIARY),
    [v2Abi.functions.getIsRevoked.selector]: encodeBool(false),
    [v2Abi.functions.getIsRevocable.selector]: encodeBool(true),
    [v2Abi.functions.getReleased.selector]: encodeUint(0n),
    [v2Abi.functions.getStart.selector]: encodeUint(1700000000n),
    [v2Abi.functions.getCliff.selector]: encodeUint(100n),
    [v2Abi.functions.getPeriod.selector]: encodeUint(2592000n),
    [v2Abi.functions.getVestedPerPeriod.selector]: encodeUints([1562n * ETH, 1563n * ETH]),
    [v2Abi.functions.paused.selector]: encodeBool(true),
    [v2Abi.functions.getIsPausable.selector]: encodeBool(true),
    [v2Abi.functions.getStop.selector]: encodeUint(0n),
    [v2Abi.functions.getIsLinear.selector]: encodeBool(false),
  })
  const fields = await createVestingReader(network, rpc).read(VESTING, BLOCK)
  assert.equal(fields?.version, 2)
  assert.equal(fields?.cliff, 1700000100n)
  assert.equal(fields?.duration, 2592000n * 2n)
  assert.deepEqual(fields?.vestedPerPeriod, [1562n, 1563n])
  assert.equal(fields?.total, 3125n)
  assert.equal(fields?.paused, true)
  assert.equal(fields?.linear, false)
})

test('a contract with no code, or whose getters all revert, is not a vesting', async () => {
  assert.equal(await createVestingReader(network, fakeRpc({}).rpc).read(VESTING, BLOCK), undefined)
  const reverting = Object.fromEntries(
    [...Object.values(v1Abi.functions), ...Object.values(v2Abi.functions)].map((f) => [f.selector, revert()])
  )
  assert.equal(await createVestingReader(network, fakeRpc(reverting).rpc).read(VESTING, BLOCK), undefined)
})

test('a clone whose implementation fails in a way other than a revert is not a vesting either', async () => {
  for (const message of ['out of gas', 'invalid opcode: INVALID', 'stack underflow (0 <=> 1)', 'invalid jump destination']) {
    const { rpc } = fakeRpc({ [v1Abi.functions.duration.selector]: new RpcError({ code: -32000, message }) })
    assert.equal(await createVestingReader(network, rpc).read(VESTING, BLOCK), undefined, message)
  }
})

test('an empty answer from a node that does not hold the block that created the clone fails the read, to be made again', async () => {
  await assert.rejects(createVestingReader(network, fakeRpc({}, false).rpc).read(VESTING, BLOCK), /does not hold block/)
})

test('a clone with no code at a block the node holds, destroyed by its initializer in the transaction that created it, is not a vesting', async () => {
  // Every call to a contract with no code answers nothing.
  assert.equal(await createVestingReader(network, fakeRpc({}).rpc).read(VESTING, BLOCK), undefined)
})

test('only failures of the call, not of the node, are deterministic', () => {
  assert.equal(deterministic(new RpcError({ code: 3, message: 'execution reverted' })), true)
  assert.equal(deterministic(new RpcError({ code: -32000, message: 'out of gas' })), true)
  assert.equal(deterministic(new RpcError({ code: -32000, message: 'invalid opcode: INVALID' })), true)
  assert.equal(deterministic(new RpcError({ code: -32000, message: 'execution aborted (timeout = 5s)' })), true)
  assert.equal(deterministic(new RpcError({ code: -32000, message: 'header not found' })), false)
  assert.equal(deterministic(new RpcError({ code: -32000, message: 'missing trie node 0xab (path )' })), false)
  assert.equal(deterministic(new RpcError({ code: -32000, message: 'request timed out' })), false)
  assert.equal(deterministic(new RpcError({ code: -32005, message: 'limit exceeded' })), false)
  assert.equal(deterministic(new RpcError({ code: -32603, message: 'internal error' })), false)
  assert.equal(deterministic(new RpcConnectionError('socket hang up')), false)
  assert.equal(deterministic(new Error('out of gas')), false)
})

test('a failure that may pass on a retry fails the read', async () => {
  const { rpc } = fakeRpc({ [v1Abi.functions.duration.selector]: new RpcConnectionError('socket hang up') })
  await assert.rejects(createVestingReader(network, rpc).read(VESTING, BLOCK), RpcConnectionError)
})

test('a node that does not have the block yet is asked again', async () => {
  let failures = 1
  const { rpc } = fakeRpc({})
  const lagging = {
    async call(method: string, params?: unknown[]): Promise<unknown> {
      if (failures-- > 0) throw new RpcError({ code: -32001, message: `block not found: hash ${BLOCK.hash}` })
      return (rpc as { call: (method: string, params?: unknown[]) => Promise<unknown> }).call(method, params)
    },
  }
  // No code: not a vesting, once the node answers.
  assert.equal(await createVestingReader(network, lagging as never, 0).read(VESTING, BLOCK), undefined)
  // Asked again after the failure, and then on.
  assert.ok(failures < 0)
})
