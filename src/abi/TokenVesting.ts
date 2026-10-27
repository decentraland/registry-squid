import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Released: event("0xfb81f9b30d73d830c3544b34d827c08142579ee75710b490bab0b3995468c565", "Released(uint256)", {"amount": p.uint256}),
    Revoked: event("0x44825a4b2df8acb19ce4e1afba9aa850c8b65cdb7942e2078f27d0b0960efee6", "Revoked()", {}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
}

export const functions = {
    duration: viewFun("0x0fb5a6b4", "duration()", {}, p.uint256),
    cliff: viewFun("0x13d033c0", "cliff()", {}, p.uint256),
    initialized: viewFun("0x158ef93e", "initialized()", {}, p.bool),
    beneficiary: viewFun("0x38af3eed", "beneficiary()", {}, p.address),
    vestedAmount: viewFun("0x44b1231f", "vestedAmount()", {}, p.uint256),
    releasableAmount: viewFun("0x5b940081", "releasableAmount()", {}, p.uint256),
    revoked: viewFun("0x63d256ce", "revoked()", {}, p.bool),
    initialize: fun("0x841bee0d", "initialize(address,address,uint256,uint256,uint256,bool,address)", {"_owner": p.address, "_beneficiary": p.address, "_start": p.uint256, "_cliff": p.uint256, "_duration": p.uint256, "_revocable": p.bool, "_token": p.address}, ),
    release: fun("0x86d1a69f", "release()", {}, ),
    revocable: viewFun("0x872a7810", "revocable()", {}, p.bool),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    released: viewFun("0x96132521", "released()", {}, p.uint256),
    releaseForeignToken: fun("0x980c2f21", "releaseForeignToken(address,uint256)", {"_token": p.address, "amount": p.uint256}, ),
    revoke: fun("0xb6549f75", "revoke()", {}, ),
    start: viewFun("0xbe9a6555", "start()", {}, p.uint256),
    releaseTo: fun("0xd1fb5646", "releaseTo(address)", {"target": p.address}, ),
    changeBeneficiary: fun("0xdc070657", "changeBeneficiary(address)", {"target": p.address}, ),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    token: viewFun("0xfc0c546a", "token()", {}, p.address),
}

export class Contract extends ContractBase {

    duration() {
        return this.eth_call(functions.duration, {})
    }

    cliff() {
        return this.eth_call(functions.cliff, {})
    }

    initialized() {
        return this.eth_call(functions.initialized, {})
    }

    beneficiary() {
        return this.eth_call(functions.beneficiary, {})
    }

    vestedAmount() {
        return this.eth_call(functions.vestedAmount, {})
    }

    releasableAmount() {
        return this.eth_call(functions.releasableAmount, {})
    }

    revoked() {
        return this.eth_call(functions.revoked, {})
    }

    revocable() {
        return this.eth_call(functions.revocable, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    released() {
        return this.eth_call(functions.released, {})
    }

    start() {
        return this.eth_call(functions.start, {})
    }

    token() {
        return this.eth_call(functions.token, {})
    }
}

/// Event types
export type ReleasedEventArgs = EParams<typeof events.Released>
export type RevokedEventArgs = EParams<typeof events.Revoked>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>

/// Function types
export type DurationParams = FunctionArguments<typeof functions.duration>
export type DurationReturn = FunctionReturn<typeof functions.duration>

export type CliffParams = FunctionArguments<typeof functions.cliff>
export type CliffReturn = FunctionReturn<typeof functions.cliff>

export type InitializedParams = FunctionArguments<typeof functions.initialized>
export type InitializedReturn = FunctionReturn<typeof functions.initialized>

export type BeneficiaryParams = FunctionArguments<typeof functions.beneficiary>
export type BeneficiaryReturn = FunctionReturn<typeof functions.beneficiary>

export type VestedAmountParams = FunctionArguments<typeof functions.vestedAmount>
export type VestedAmountReturn = FunctionReturn<typeof functions.vestedAmount>

export type ReleasableAmountParams = FunctionArguments<typeof functions.releasableAmount>
export type ReleasableAmountReturn = FunctionReturn<typeof functions.releasableAmount>

export type RevokedParams = FunctionArguments<typeof functions.revoked>
export type RevokedReturn = FunctionReturn<typeof functions.revoked>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type ReleaseParams = FunctionArguments<typeof functions.release>
export type ReleaseReturn = FunctionReturn<typeof functions.release>

export type RevocableParams = FunctionArguments<typeof functions.revocable>
export type RevocableReturn = FunctionReturn<typeof functions.revocable>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type ReleasedParams = FunctionArguments<typeof functions.released>
export type ReleasedReturn = FunctionReturn<typeof functions.released>

export type ReleaseForeignTokenParams = FunctionArguments<typeof functions.releaseForeignToken>
export type ReleaseForeignTokenReturn = FunctionReturn<typeof functions.releaseForeignToken>

export type RevokeParams = FunctionArguments<typeof functions.revoke>
export type RevokeReturn = FunctionReturn<typeof functions.revoke>

export type StartParams = FunctionArguments<typeof functions.start>
export type StartReturn = FunctionReturn<typeof functions.start>

export type ReleaseToParams = FunctionArguments<typeof functions.releaseTo>
export type ReleaseToReturn = FunctionReturn<typeof functions.releaseTo>

export type ChangeBeneficiaryParams = FunctionArguments<typeof functions.changeBeneficiary>
export type ChangeBeneficiaryReturn = FunctionReturn<typeof functions.changeBeneficiary>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type TokenParams = FunctionArguments<typeof functions.token>
export type TokenReturn = FunctionReturn<typeof functions.token>

