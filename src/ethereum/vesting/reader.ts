import { FunctionResultDecodeError } from '@subsquid/evm-abi'
import { RpcClient, RpcError } from '@subsquid/rpc-client'
import * as v1Abi from '../../abi/TokenVesting'
import * as v2Abi from '../../abi/PeriodicTokenVesting'
import { lower } from '../../common/hex'
import { VestingNetwork } from './config'
import { tokens, VestingFields, VestingReader } from './state'

/**
 * A call the contract refused, as the node reports it: on a version 2 contract, a version 1 function
 * it does not have. A transport failure, a timeout or a rate limit is not one, whatever its text.
 */
export function reverted(e: unknown): boolean {
  return e instanceof RpcError && (e.code === 3 || /revert/i.test(e.message))
}

/**
 * A call that fails the same way whenever it is made: a revert, or an answer that is not what the
 * function returns (the empty one of an address with no code). Anything else may pass on a retry.
 */
export function deterministic(e: unknown): boolean {
  return reverted(e) || e instanceof FunctionResultDecodeError
}

/** A node that does not have the block yet: it lags the portal at the tip, and catches up. */
const UNKNOWN_BLOCK = /block not found|unknown block|header not found/i
const UNKNOWN_BLOCK_RETRIES = 10
const UNKNOWN_BLOCK_DELAY_MS = 3000

/**
 * The RPC with every `eth_call` made at the block of that hash (EIP-1898), not at its height: at the
 * unfinalized tip, the block at a height may be another one on the node. A node that does not have
 * the block yet is asked again for a while; past that, the error fails the batch, which is retried.
 */
function atBlockHash(rpc: Pick<RpcClient, 'call'>, blockHash: string, delayMs: number): Pick<RpcClient, 'call'> {
  return {
    async call(method: string, params?: unknown[]) {
      if (method !== 'eth_call' || !params) return rpc.call(method, params)
      for (let attempt = 0; ; attempt++) {
        try {
          return await rpc.call(method, [params[0], { blockHash }])
        } catch (e) {
          if (!(e instanceof RpcError) || !UNKNOWN_BLOCK.test(e.message) || attempt >= UNKNOWN_BLOCK_RETRIES) throw e
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    },
  } as Pick<RpcClient, 'call'>
}

/**
 * Reads a vesting contract over RPC at the block the factory created it at, as the subgraph's
 * mapping does, at the end of that block: a release or pause later in the same block is already in
 * what it reads, and is then applied once more, as on the subgraph. Also as the mapping does: a
 * contract that answers `duration()` is version 1 (TokenVesting), any other version 2
 * (PeriodicTokenVesting). See schema/vesting.graphql for how each field is read.
 *
 * The factory creates a contract for anyone, with any implementation. One that cannot be read as
 * either version (no code, or getters that revert) is not a vesting: it is answered as `undefined`
 * and left out, rather than failing every batch from its block on. The subgraph would stop there.
 */
export function createVestingReader(
  network: VestingNetwork,
  rpc: Pick<RpcClient, 'call'>,
  unknownBlockDelayMs = UNKNOWN_BLOCK_DELAY_MS
): VestingReader {

  async function readV1(contract: v1Abi.Contract, vesting: string, duration: bigint): Promise<VestingFields> {
    const [token, owner, beneficiary, revoked, revocable, released, start, cliff] = await Promise.all([
      contract.token(),
      contract.owner(),
      contract.beneficiary(),
      contract.revoked(),
      contract.revocable(),
      contract.released(),
      contract.start(),
      contract.cliff(),
    ])
    return {
      version: 1,
      token: lower(token),
      owner: lower(owner),
      beneficiary: lower(beneficiary),
      revoked,
      revocable,
      released: tokens(released),
      start,
      cliff,
      periodDuration: 0n,
      vestedPerPeriod: [],
      duration,
      paused: false,
      pausable: false,
      stop: 0n,
      linear: true,
      total: BigInt(network.v1Totals[vesting] ?? 0),
    }
  }

  async function readV2(contract: v2Abi.Contract): Promise<VestingFields> {
    const [token, owner, beneficiary, revoked, revocable, released, start, cliff, period, perPeriod, paused, pausable, stop, linear] =
      await Promise.all([
        contract.getToken(),
        contract.owner(),
        contract.getBeneficiary(),
        contract.getIsRevoked(),
        contract.getIsRevocable(),
        contract.getReleased(),
        contract.getStart(),
        contract.getCliff(),
        contract.getPeriod(),
        contract.getVestedPerPeriod(),
        contract.paused(),
        contract.getIsPausable(),
        contract.getStop(),
        contract.getIsLinear(),
      ])
    const vestedPerPeriod = perPeriod.map(tokens)
    return {
      version: 2,
      token: lower(token),
      owner: lower(owner),
      beneficiary: lower(beneficiary),
      revoked,
      revocable,
      released: tokens(released),
      start,
      cliff: start + cliff,
      periodDuration: period,
      vestedPerPeriod,
      duration: period * BigInt(vestedPerPeriod.length),
      paused,
      pausable,
      stop,
      linear,
      total: vestedPerPeriod.reduce((sum, amount) => sum + amount, 0n),
    }
  }

  return {
    async read(vesting, { height, hash }) {
      const chain = { _chain: { client: atBlockHash(rpc, hash, unknownBlockDelayMs) } }
      const block = { height }
      const v1 = new v1Abi.Contract(chain, block, vesting)
      try {
        let duration: bigint
        try {
          duration = await v1.duration()
        } catch (e) {
          if (!reverted(e)) throw e
          return await readV2(new v2Abi.Contract(chain, block, vesting))
        }
        return await readV1(v1, vesting, duration)
      } catch (e) {
        if (deterministic(e)) return undefined
        throw e
      }
    },
  }
}
