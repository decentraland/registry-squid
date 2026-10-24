import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    BeneficiaryUpdated: event("0xeee59a71c694e68368a1cb0d135c448051bbfb12289e6c2223b0ceb100c2321d", "BeneficiaryUpdated(address)", {"_newBeneficiary": indexed(p.address)}),
    Initialized: event("0x7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498", "Initialized(uint8)", {"version": p.uint8}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    Paused: event("0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258", "Paused(address)", {"account": p.address}),
    Released: event("0xb21fb52d5749b80f3182f8c6992236b5e5576681880914484d7f4c9b062e619e", "Released(address,uint256)", {"_receiver": indexed(p.address), "_amount": p.uint256}),
    ReleasedForeign: event("0x168238477179452184b533e54fe463e4a2f229d1813280fec2726195c726590c", "ReleasedForeign(address,address,uint256)", {"_receiver": indexed(p.address), "_token": indexed(p.address), "_amount": p.uint256}),
    ReleasedSurplus: event("0x559bbd09257103a22e16b694174241604744d0bd4b7edb79b4898cca8aa95b55", "ReleasedSurplus(address,uint256)", {"_receiver": indexed(p.address), "_amount": p.uint256}),
    Revoked: event("0x44825a4b2df8acb19ce4e1afba9aa850c8b65cdb7942e2078f27d0b0960efee6", "Revoked()", {}),
    Unpaused: event("0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa", "Unpaused(address)", {"account": p.address}),
}

export const functions = {
    getBeneficiary: viewFun("0x565a2e2c", "getBeneficiary()", {}, p.address),
    getCliff: viewFun("0x63260e36", "getCliff()", {}, p.uint256),
    getIsLinear: viewFun("0xa4611150", "getIsLinear()", {}, p.bool),
    getIsPausable: viewFun("0xe5ac586c", "getIsPausable()", {}, p.bool),
    getIsRevocable: viewFun("0x16a8ab9a", "getIsRevocable()", {}, p.bool),
    getIsRevoked: viewFun("0x09b058aa", "getIsRevoked()", {}, p.bool),
    getPeriod: viewFun("0x1ed24195", "getPeriod()", {}, p.uint256),
    getReleasable: viewFun("0x21617565", "getReleasable()", {}, p.uint256),
    getReleased: viewFun("0xf47a6e84", "getReleased()", {}, p.uint256),
    getStart: viewFun("0xc5292c67", "getStart()", {}, p.uint256),
    getStop: viewFun("0xe5d47eed", "getStop()", {}, p.uint256),
    getToken: viewFun("0x21df0da7", "getToken()", {}, p.address),
    getTotal: viewFun("0x775a25e3", "getTotal()", {}, p.uint256),
    getVested: viewFun("0x0d60e553", "getVested()", {}, p.uint256),
    getVestedPerPeriod: viewFun("0x7af6842c", "getVestedPerPeriod()", {}, p.array(p.uint256)),
    initialize: fun("0xde0577f8", "initialize(address,address,address,bool,bool,bool,uint256,uint256,uint256,uint256[])", {"_owner": p.address, "_beneficiary": p.address, "_token": p.address, "_isRevocable": p.bool, "_isPausable": p.bool, "_isLinear": p.bool, "_start": p.uint256, "_period": p.uint256, "_cliff": p.uint256, "_vestedPerPeriod": p.array(p.uint256)}, ),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    pause: fun("0x8456cb59", "pause()", {}, ),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    release: fun("0x0357371d", "release(address,uint256)", {"_receiver": p.address, "_amount": p.uint256}, ),
    releaseForeignToken: fun("0xba27ea6a", "releaseForeignToken(address,address,uint256)", {"_token": p.address, "_receiver": p.address, "_amount": p.uint256}, ),
    releaseSurplus: fun("0xf7e96e16", "releaseSurplus(address,uint256)", {"_receiver": p.address, "_amount": p.uint256}, ),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    revoke: fun("0xb6549f75", "revoke()", {}, ),
    setBeneficiary: fun("0x1c31f710", "setBeneficiary(address)", {"_newBeneficiary": p.address}, ),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
}

export class Contract extends ContractBase {

    getBeneficiary() {
        return this.eth_call(functions.getBeneficiary, {})
    }

    getCliff() {
        return this.eth_call(functions.getCliff, {})
    }

    getIsLinear() {
        return this.eth_call(functions.getIsLinear, {})
    }

    getIsPausable() {
        return this.eth_call(functions.getIsPausable, {})
    }

    getIsRevocable() {
        return this.eth_call(functions.getIsRevocable, {})
    }

    getIsRevoked() {
        return this.eth_call(functions.getIsRevoked, {})
    }

    getPeriod() {
        return this.eth_call(functions.getPeriod, {})
    }

    getReleasable() {
        return this.eth_call(functions.getReleasable, {})
    }

    getReleased() {
        return this.eth_call(functions.getReleased, {})
    }

    getStart() {
        return this.eth_call(functions.getStart, {})
    }

    getStop() {
        return this.eth_call(functions.getStop, {})
    }

    getToken() {
        return this.eth_call(functions.getToken, {})
    }

    getTotal() {
        return this.eth_call(functions.getTotal, {})
    }

    getVested() {
        return this.eth_call(functions.getVested, {})
    }

    getVestedPerPeriod() {
        return this.eth_call(functions.getVestedPerPeriod, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    paused() {
        return this.eth_call(functions.paused, {})
    }
}

/// Event types
export type BeneficiaryUpdatedEventArgs = EParams<typeof events.BeneficiaryUpdated>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PausedEventArgs = EParams<typeof events.Paused>
export type ReleasedEventArgs = EParams<typeof events.Released>
export type ReleasedForeignEventArgs = EParams<typeof events.ReleasedForeign>
export type ReleasedSurplusEventArgs = EParams<typeof events.ReleasedSurplus>
export type RevokedEventArgs = EParams<typeof events.Revoked>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>

/// Function types
export type GetBeneficiaryParams = FunctionArguments<typeof functions.getBeneficiary>
export type GetBeneficiaryReturn = FunctionReturn<typeof functions.getBeneficiary>

export type GetCliffParams = FunctionArguments<typeof functions.getCliff>
export type GetCliffReturn = FunctionReturn<typeof functions.getCliff>

export type GetIsLinearParams = FunctionArguments<typeof functions.getIsLinear>
export type GetIsLinearReturn = FunctionReturn<typeof functions.getIsLinear>

export type GetIsPausableParams = FunctionArguments<typeof functions.getIsPausable>
export type GetIsPausableReturn = FunctionReturn<typeof functions.getIsPausable>

export type GetIsRevocableParams = FunctionArguments<typeof functions.getIsRevocable>
export type GetIsRevocableReturn = FunctionReturn<typeof functions.getIsRevocable>

export type GetIsRevokedParams = FunctionArguments<typeof functions.getIsRevoked>
export type GetIsRevokedReturn = FunctionReturn<typeof functions.getIsRevoked>

export type GetPeriodParams = FunctionArguments<typeof functions.getPeriod>
export type GetPeriodReturn = FunctionReturn<typeof functions.getPeriod>

export type GetReleasableParams = FunctionArguments<typeof functions.getReleasable>
export type GetReleasableReturn = FunctionReturn<typeof functions.getReleasable>

export type GetReleasedParams = FunctionArguments<typeof functions.getReleased>
export type GetReleasedReturn = FunctionReturn<typeof functions.getReleased>

export type GetStartParams = FunctionArguments<typeof functions.getStart>
export type GetStartReturn = FunctionReturn<typeof functions.getStart>

export type GetStopParams = FunctionArguments<typeof functions.getStop>
export type GetStopReturn = FunctionReturn<typeof functions.getStop>

export type GetTokenParams = FunctionArguments<typeof functions.getToken>
export type GetTokenReturn = FunctionReturn<typeof functions.getToken>

export type GetTotalParams = FunctionArguments<typeof functions.getTotal>
export type GetTotalReturn = FunctionReturn<typeof functions.getTotal>

export type GetVestedParams = FunctionArguments<typeof functions.getVested>
export type GetVestedReturn = FunctionReturn<typeof functions.getVested>

export type GetVestedPerPeriodParams = FunctionArguments<typeof functions.getVestedPerPeriod>
export type GetVestedPerPeriodReturn = FunctionReturn<typeof functions.getVestedPerPeriod>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type PausedParams = FunctionArguments<typeof functions.paused>
export type PausedReturn = FunctionReturn<typeof functions.paused>

export type ReleaseParams = FunctionArguments<typeof functions.release>
export type ReleaseReturn = FunctionReturn<typeof functions.release>

export type ReleaseForeignTokenParams = FunctionArguments<typeof functions.releaseForeignToken>
export type ReleaseForeignTokenReturn = FunctionReturn<typeof functions.releaseForeignToken>

export type ReleaseSurplusParams = FunctionArguments<typeof functions.releaseSurplus>
export type ReleaseSurplusReturn = FunctionReturn<typeof functions.releaseSurplus>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type RevokeParams = FunctionArguments<typeof functions.revoke>
export type RevokeReturn = FunctionReturn<typeof functions.revoke>

export type SetBeneficiaryParams = FunctionArguments<typeof functions.setBeneficiary>
export type SetBeneficiaryReturn = FunctionReturn<typeof functions.setBeneficiary>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

