// Vestings: every TokenVesting (version 1) and PeriodicTokenVesting (version 2) the vesting factory
// creates on Ethereum. A port of the squid's src/vesting/{state,reader}.ts, which mirror the
// vestings subgraph, oddities included (see ../../schema/vesting.graphql in the squid).
//
// The factory's VestingCreated registers each new contract (contractRegister), so its events are
// indexed from the block that created it: no address snapshot and no topic-wide scan are needed.
// Each new contract is read once over RPC, at the block that created it, through the Effect API.

import { createEffect, indexer, S, type EvmOnEventContext } from 'envio'
import {
  createPublicClient,
  http,
  parseAbi,
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  AbiDecodingZeroDataError,
} from 'viem'
import { mainnet } from 'viem/chains'
import { V1_TOTALS } from '../common/vesting-v1-totals.js'

type Ctx = EvmOnEventContext

/**
 * An archive node is required: each vesting is read at the block that created it. The default is
 * the public Decentraland RPC the squid uses by default.
 */
const RPC_URL = process.env.ENVIO_RPC_ENDPOINT_ETH || 'https://rpc.decentraland.org/mainnet'

const client = createPublicClient({
  chain: mainnet,
  // JSON-RPC batching folds one vesting's ~15 reads, and concurrent vestings', into few requests.
  // Retries are handled below, so viem's own are off.
  transport: http(RPC_URL, { batch: true, retryCount: 0, timeout: 30_000 }),
})

const V1_ABI = parseAbi([
  'function duration() view returns (uint256)',
  'function token() view returns (address)',
  'function owner() view returns (address)',
  'function beneficiary() view returns (address)',
  'function revoked() view returns (bool)',
  'function revocable() view returns (bool)',
  'function released() view returns (uint256)',
  'function start() view returns (uint256)',
  'function cliff() view returns (uint256)',
])

const V2_ABI = parseAbi([
  'function getToken() view returns (address)',
  'function owner() view returns (address)',
  'function getBeneficiary() view returns (address)',
  'function getIsRevoked() view returns (bool)',
  'function getIsRevocable() view returns (bool)',
  'function getReleased() view returns (uint256)',
  'function getStart() view returns (uint256)',
  'function getCliff() view returns (uint256)',
  'function getPeriod() view returns (uint256)',
  'function getVestedPerPeriod() view returns (uint256[])',
  'function paused() view returns (bool)',
  'function getIsPausable() view returns (bool)',
  'function getStop() view returns (uint256)',
  'function getIsLinear() view returns (bool)',
])

/** Wei as the subgraph keeps amounts: whole tokens, rounded down. */
export const tokens = (wei: bigint) => wei / 10n ** 18n

function rpcCode(e: unknown): number | undefined {
  if (!(e instanceof BaseError)) return undefined
  const found = e.walk((x) => typeof (x as { code?: unknown }).code === 'number') as { code?: number } | null
  return found?.code
}

/** A call the contract refused: on a version 2 contract, a version 1 function it lacks. */
export function reverted(e: unknown): boolean {
  if (e instanceof BaseError && e.walk((x) => x instanceof ContractFunctionRevertedError)) return true
  return rpcCode(e) === 3 || (e instanceof BaseError && /execution reverted/i.test(e.details ?? ''))
}

const NODE_FAILURE =
  /rate limit|too many requests|limit exceeded|quota|timeout|timed out|missing trie node|historical state|state.*not available|pruned|internal error|upstream|backend|busy|unavailable|overloaded|capacity|connection|not found/i

/**
 * A call that fails the same way whenever it is made, so the contract may not be a vesting: a
 * revert, an empty or undecodable answer, or a VM error the node reports. Never a transport failure.
 */
export function deterministic(e: unknown): boolean {
  if (!(e instanceof BaseError)) return false
  if (e.walk((x) => x instanceof ContractFunctionZeroDataError || x instanceof AbiDecodingZeroDataError)) return true
  if (reverted(e)) return true
  const details = e.details ?? ''
  if (/execution aborted/i.test(details)) return true
  const code = rpcCode(e)
  return (code === -32000 || code === -32015) && !NODE_FAILURE.test(details)
}

const VestingFields = S.schema({
  version: S.number,
  duration: S.bigint,
  cliff: S.bigint,
  beneficiary: S.string,
  revoked: S.boolean,
  revocable: S.boolean,
  released: S.bigint,
  start: S.bigint,
  periodDuration: S.bigint,
  vestedPerPeriod: S.array(S.string),
  paused: S.boolean,
  pausable: S.boolean,
  stop: S.bigint,
  linear: S.boolean,
  token: S.string,
  owner: S.string,
  total: S.bigint,
})

async function readAt(vesting: `0x${string}`, blockNumber: bigint) {
  const v1 = <F extends (typeof V1_ABI)[number]['name']>(functionName: F) =>
    client.readContract({ address: vesting, abi: V1_ABI, functionName, blockNumber })
  const v2 = <F extends (typeof V2_ABI)[number]['name']>(functionName: F) =>
    client.readContract({ address: vesting, abi: V2_ABI, functionName, blockNumber })

  // As the subgraph does: a contract that answers duration() is version 1, any other version 2.
  let duration: bigint
  try {
    duration = await v1('duration')
  } catch (e) {
    if (!reverted(e)) throw e
    const [token, owner, beneficiary, revoked, revocable, released, start, cliff, period, perPeriod, paused, pausable, stop, linear] =
      await Promise.all([
        v2('getToken'),
        v2('owner'),
        v2('getBeneficiary'),
        v2('getIsRevoked'),
        v2('getIsRevocable'),
        v2('getReleased'),
        v2('getStart'),
        v2('getCliff'),
        v2('getPeriod'),
        v2('getVestedPerPeriod'),
        v2('paused'),
        v2('getIsPausable'),
        v2('getStop'),
        v2('getIsLinear'),
      ])
    const vestedPerPeriod = (perPeriod as readonly bigint[]).map(tokens)
    return {
      version: 2,
      token: (token as string).toLowerCase(),
      owner: (owner as string).toLowerCase(),
      beneficiary: (beneficiary as string).toLowerCase(),
      revoked: revoked as boolean,
      revocable: revocable as boolean,
      released: tokens(released as bigint),
      start: start as bigint,
      cliff: (start as bigint) + (cliff as bigint),
      periodDuration: period as bigint,
      vestedPerPeriod: vestedPerPeriod.map(String),
      duration: (period as bigint) * BigInt(vestedPerPeriod.length),
      paused: paused as boolean,
      pausable: pausable as boolean,
      stop: stop as bigint,
      linear: linear as boolean,
      total: vestedPerPeriod.reduce((sum, amount) => sum + amount, 0n),
    }
  }
  const [token, owner, beneficiary, revoked, revocable, released, start, cliff] = await Promise.all([
    v1('token'),
    v1('owner'),
    v1('beneficiary'),
    v1('revoked'),
    v1('revocable'),
    v1('released'),
    v1('start'),
    v1('cliff'),
  ])
  return {
    version: 1,
    token: (token as string).toLowerCase(),
    owner: (owner as string).toLowerCase(),
    beneficiary: (beneficiary as string).toLowerCase(),
    revoked: revoked as boolean,
    revocable: revocable as boolean,
    released: tokens(released as bigint),
    start: start as bigint,
    cliff: cliff as bigint,
    periodDuration: 0n,
    vestedPerPeriod: [] as string[],
    duration,
    paused: false,
    pausable: false,
    stop: 0n,
    linear: true,
    total: BigInt(V1_TOTALS[vesting] ?? 0),
  }
}

const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000]
const MAX_ATTEMPTS = 30
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Reads a vesting contract at the end of the block that created it, as the subgraph's mapping does.
 * Node and transport failures are retried. A contract that fails deterministically twice (no code,
 * getters that revert) is not a vesting: it answers null and is left out, as in the squid.
 */
export const readVesting = createEffect(
  {
    name: 'readVesting',
    input: { address: S.string, blockNumber: S.number },
    output: S.union([VestingFields, null]),
    cache: true,
    rateLimit: { calls: 10, per: 'second' },
  },
  async ({ input, context }) => {
    const address = input.address.toLowerCase() as `0x${string}`
    const block = BigInt(input.blockNumber)
    let deterministicFailures = 0
    for (let attempt = 0; ; attempt++) {
      try {
        return await readAt(address, block)
      } catch (e) {
        if (deterministic(e)) {
          if (++deterministicFailures >= 2) {
            context.log.warn(`${address}, created at block ${input.blockNumber}, cannot be read as a vesting contract: left out`)
            return null
          }
        } else if (attempt >= MAX_ATTEMPTS) {
          throw e
        }
        await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!)
      }
    }
  }
)

// --- Handlers --------------------------------------------------------------------------------

indexer.contractRegister({ contract: 'VestingFactory', event: 'VestingCreated' }, async ({ event, context }) => {
  context.chain.Vesting.add(event.params._address)
})

indexer.onEvent({ contract: 'VestingFactory', event: 'VestingCreated' }, async ({ event, context }) => {
  const id = event.params._address.toLowerCase()
  const fields = await context.effect(readVesting, { address: id, blockNumber: event.block.number })
  if (!fields) return
  context.Vesting.set({ ...fields, id, revokeTimestamp: undefined })
})

async function vestingOf(context: Ctx, srcAddress: string) {
  return context.Vesting.get(srcAddress.toLowerCase())
}

const TS = { block: ['timestamp'] } as const

async function released(context: Ctx, event: { srcAddress: string; block: { timestamp: number } }, wei: bigint) {
  const vesting = await vestingOf(context, event.srcAddress)
  if (!vesting) return
  const amount = tokens(wei)
  const timestamp = BigInt(event.block.timestamp)
  context.Vesting.set({ ...vesting, released: vesting.released + amount })
  // One id per vesting and timestamp: a second release in the same block replaces the first.
  context.ReleaseLog.set({ id: `${vesting.id}-${timestamp}`, timestamp, amount, vesting_id: vesting.id })
}

// A version 1 contract emits the running total released; the subgraph adds it up all the same.
indexer.onEvent({ contract: 'Vesting', event: 'ReleasedV1', fields: TS }, async ({ event, context }) => {
  await released(context, event, event.params.amount)
})
indexer.onEvent({ contract: 'Vesting', event: 'ReleasedV2', fields: TS }, async ({ event, context }) => {
  await released(context, event, event.params._amount)
})

async function pause(context: Ctx, event: { srcAddress: string; block: { timestamp: number } }, kind: 'Paused' | 'Unpaused') {
  const vesting = await vestingOf(context, event.srcAddress)
  if (!vesting) return
  const timestamp = BigInt(event.block.timestamp)
  context.Vesting.set({ ...vesting, paused: kind === 'Paused' })
  context.PausedLog.set({ id: `${vesting.id}-${timestamp}-${kind}`, timestamp, eventType: kind, vesting_id: vesting.id })
}

indexer.onEvent({ contract: 'Vesting', event: 'Paused', fields: TS }, async ({ event, context }) => {
  await pause(context, event, 'Paused')
})
indexer.onEvent({ contract: 'Vesting', event: 'Unpaused', fields: TS }, async ({ event, context }) => {
  await pause(context, event, 'Unpaused')
})

indexer.onEvent({ contract: 'Vesting', event: 'Revoked', fields: TS }, async ({ event, context }) => {
  const vesting = await vestingOf(context, event.srcAddress)
  if (!vesting) return
  context.Vesting.set({ ...vesting, revoked: true, revokeTimestamp: BigInt(event.block.timestamp) })
})
