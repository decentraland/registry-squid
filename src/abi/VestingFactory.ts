import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    VestingCreated: event("0xeaa996f76fa9fcacd351918a2a275ae6d45845f79256ffbe8c0a87ca608e9970", "VestingCreated(address,bytes32)", {"_address": indexed(p.address), "_salt": p.bytes32}),
}

export const functions = {
    createVesting: fun("0x8374d84b", "createVesting(address,bytes32,bytes)", {"_implementation": p.address, "_salt": p.bytes32, "_data": p.bytes}, p.address),
}

export class Contract extends ContractBase {
}

/// Event types
export type VestingCreatedEventArgs = EParams<typeof events.VestingCreated>

/// Function types
export type CreateVestingParams = FunctionArguments<typeof functions.createVesting>
export type CreateVestingReturn = FunctionReturn<typeof functions.createVesting>

