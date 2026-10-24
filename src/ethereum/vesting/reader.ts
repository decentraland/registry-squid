import { RpcClient } from '@subsquid/rpc-client'
import * as v1Abi from '../../abi/TokenVesting'
import * as v2Abi from '../../abi/PeriodicTokenVesting'
import { lower } from '../../common/hex'
import { VestingNetwork } from './config'
import { tokens, VestingFields, VestingReader } from './state'

/** A call the contract refused: on a version 2 contract, a version 1 function it does not have. */
function reverted(e: unknown): boolean {
  return /revert/i.test(e instanceof Error ? e.message : String(e))
}

/**
 * Reads a vesting contract over RPC at the block the factory created it at, as the subgraph's
 * mapping does: a contract that answers `duration()` is version 1 (TokenVesting), any other version 2
 * (PeriodicTokenVesting). See schema/vesting.graphql for how each field is read.
 */
export function createVestingReader(network: VestingNetwork, rpc: RpcClient): VestingReader {
  const chain = { _chain: { client: { call: <T>(method: string, params?: unknown[]) => rpc.call<T>(method, params as unknown[]) } } }

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
    async read(vesting, blockNumber) {
      const block = { height: blockNumber }
      const v1 = new v1Abi.Contract(chain, block, vesting)
      let duration: bigint
      try {
        duration = await v1.duration()
      } catch (e) {
        if (!reverted(e)) throw e
        return readV2(new v2Abi.Contract(chain, block, vesting))
      }
      return readV1(v1, vesting, duration)
    },
  }
}
