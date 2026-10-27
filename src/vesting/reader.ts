import { FunctionResultDecodeError } from '@subsquid/evm-abi'
import { RpcClient, RpcError } from '@subsquid/rpc-client'
import * as v1Abi from '../abi/TokenVesting'
import * as v2Abi from '../abi/PeriodicTokenVesting'
import { lower } from '../common/hex'
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
 * The RPC client for the vesting reads. `RpcClient` retries an error whose text says `rate limit` or
 * `timeout`, whatever its code, so a contract that runs `revert("rate limit")` would be read again
 * forever and hold the processor at its block. A revert is the contract's answer: never retried.
 */
export class VestingRpcClient extends RpcClient {
  isConnectionError(err: Error): boolean {
    return !reverted(err) && super.isConnectionError(err)
  }
}

/**
 * A node that does not have the block yet: it lags the portal at the tip, and catches up. Geth says
 * `header not found` or `header for hash not found`, erigon `block 0x… not found`.
 */
const UNKNOWN_BLOCK = /block .*not found|unknown block|header .*not found/i
const UNKNOWN_BLOCK_RETRIES = 10
const UNKNOWN_BLOCK_DELAY_MS = 3000

/**
 * Failures of the node rather than of the call: they may pass when the call is made again. A node
 * that is not an archive node (`missing trie node`) fails every historical read until it is replaced.
 */
const NODE_FAILURE =
  /rate limit|too many requests|limit exceeded|quota|timeout|timed out|missing trie node|historical state|state.*not available|pruned|internal error|upstream|backend|busy|unavailable|overloaded|capacity|connection/i

/**
 * A call that seems to fail the same way whenever it is made, so the contract may not be a vesting:
 * an answer that is not what the function returns, or any error the node reports for executing the
 * call (code 3, or geth's -32000 with the bare VM error: a revert, `out of gas`, `invalid opcode`,
 * `stack underflow` and the like) that is not a failure of the node itself. A transport failure is
 * never one. Geth's `execution aborted (timeout = 5s)` is one too, although it is the node's limit on
 * how long a call runs and a slow node can reach it on a real vesting: a contract that runs too long
 * runs too long every time, and would otherwise be retried forever. The reader makes such a read
 * twice before it believes it.
 */
export function deterministic(e: unknown): boolean {
  if (e instanceof FunctionResultDecodeError) return true
  if (!(e instanceof RpcError)) return false
  // First: a revert's reason is the contract's text, and may say anything a node failure says.
  if (reverted(e)) return true
  if (/execution aborted/i.test(e.message)) return true
  return (e.code === -32000 || e.code === -32015) && !UNKNOWN_BLOCK.test(e.message) && !NODE_FAILURE.test(e.message)
}

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
          if (!(e instanceof RpcError) || reverted(e) || !UNKNOWN_BLOCK.test(e.message) || attempt >= UNKNOWN_BLOCK_RETRIES) throw e
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
 * either version (an implementation with no code, getters that revert or fail in any other way the
 * node reports for the call) is not a vesting: it is answered as `undefined` and left out, rather than
 * failing every batch from its block on. The subgraph would stop there. Since a node's own failure
 * can read like the call's (an error worded as no pattern here expects, or an empty answer from a
 * backend that lacks the block), a contract is left out only when a node that holds the block fails
 * the whole read twice.
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

  async function readAt(vesting: string, height: number, hash: string): Promise<VestingFields> {
    const chain = { _chain: { client: atBlockHash(rpc, hash, unknownBlockDelayMs) } }
    const block = { height }
    const v1 = new v1Abi.Contract(chain, block, vesting)
    let duration: bigint
    try {
      duration = await v1.duration()
    } catch (e) {
      if (!reverted(e)) throw e
      return readV2(new v2Abi.Contract(chain, block, vesting))
    }
    return readV1(v1, vesting, duration)
  }

  return {
    async read(vesting, { height, hash }) {
      try {
        return await readAt(vesting, height, hash)
      } catch (e) {
        if (!deterministic(e)) throw e
      }
      // Only an answer from a node that holds the block counts: one that does not (behind a load
      // balancer, say) may answer a call with nothing. The read is then failed, to be made again,
      // not dropped. A clone with no code at a block the node holds is not a vesting: its
      // initializer may have destroyed it in the transaction that created it.
      const held = await rpc.call<unknown>('eth_getBlockByHash', [hash, false])
      if (!held) throw new Error(`The node does not hold block ${hash}, which created ${vesting}`)
      // Holding the block now does not prove the failure was the contract's: the failed call may have
      // reached another backend, or this one before it caught up. The read is made once more, after
      // a while for a node that lags, and the contract left out only if it fails again in a way that
      // is not the node's.
      await new Promise((resolve) => setTimeout(resolve, unknownBlockDelayMs))
      try {
        return await readAt(vesting, height, hash)
      } catch (e) {
        if (!deterministic(e)) throw e
        return undefined
      }
    },
  }
}
