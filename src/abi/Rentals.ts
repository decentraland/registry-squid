import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AssetClaimed: event("0x64fcb03e7c10d3b0ae8a1bac00b1e9e9cdf6b593ef0e757797d21977f80183a4", "AssetClaimed(address,uint256,address)", {"_contractAddress": indexed(p.address), "_tokenId": indexed(p.uint256), "_sender": p.address}),
    AssetIndexUpdated: event("0x03b0084eb3c564c3928723736eeb4c38263fdce62f06c45eaa69df01c0415148", "AssetIndexUpdated(address,address,uint256,uint256,address)", {"_signer": indexed(p.address), "_contractAddress": indexed(p.address), "_tokenId": indexed(p.uint256), "_newIndex": p.uint256, "_sender": p.address}),
    AssetRented: event("0xfe3b2e4cd1e8ad8d90abfd715fe3d39a303e0a6e9adde116d5d10bebfa678d80", "AssetRented(address,uint256,address,address,address,uint256,uint256,bool,address,bytes)", {"_contractAddress": indexed(p.address), "_tokenId": indexed(p.uint256), "_lessor": p.address, "_tenant": p.address, "_operator": p.address, "_rentalDays": p.uint256, "_pricePerDay": p.uint256, "_isExtension": p.bool, "_sender": p.address, "_signature": p.bytes}),
    ContractIndexUpdated: event("0xa6957d63c6c422962352065c3196f36c268eda93a702712ccf4c3d810da755b3", "ContractIndexUpdated(uint256,address)", {"_newIndex": p.uint256, "_sender": p.address}),
    FeeCollectorUpdated: event("0x9dfcadd14a1ddfb19c51e84b87452ca32a43c5559e9750d1575c77105cdeac1e", "FeeCollectorUpdated(address,address,address)", {"_from": p.address, "_to": p.address, "_sender": p.address}),
    FeeUpdated: event("0x8d6ad40ad37637106f0ca2d682205c774e73f8cf7789162ce1c0b6ac0791a484", "FeeUpdated(uint256,uint256,address)", {"_from": p.uint256, "_to": p.uint256, "_sender": p.address}),
    Initialized: event("0x7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498", "Initialized(uint8)", {"version": p.uint8}),
    MetaTransactionExecuted: event("0x5845892132946850460bff5a0083f71031bc5bf9aadcd40f1de79423eac9b10b", "MetaTransactionExecuted(address,address,bytes)", {"_userAddress": indexed(p.address), "_relayerAddress": indexed(p.address), "_functionData": p.bytes}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    Paused: event("0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258", "Paused(address)", {"account": p.address}),
    SignerIndexUpdated: event("0xbcdee0760cae1a36f3773c7f12f98aa0afbafa4099c256eeb87d796f2afb7d44", "SignerIndexUpdated(address,uint256,address)", {"_signer": indexed(p.address), "_newIndex": p.uint256, "_sender": p.address}),
    Unpaused: event("0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa", "Unpaused(address)", {"account": p.address}),
}

export const functions = {
    acceptListing: fun("0x81b221f0", "acceptListing((address,address,uint256,uint256,uint256[3],uint256[],uint256[],uint256[],address,bytes),address,uint256,uint256,bytes32)", {"_listing": p.struct({"signer": p.address, "contractAddress": p.address, "tokenId": p.uint256, "expiration": p.uint256, "indexes": p.fixedSizeArray(p.uint256, 3), "pricePerDay": p.array(p.uint256), "maxDays": p.array(p.uint256), "minDays": p.array(p.uint256), "target": p.address, "signature": p.bytes}), "_operator": p.address, "_conditionIndex": p.uint256, "_rentalDays": p.uint256, "_fingerprint": p.bytes32}, ),
    acceptOffer: fun("0x061f7a02", "acceptOffer((address,address,uint256,uint256,uint256[3],uint256,uint256,address,bytes32,bytes))", {"_offer": p.struct({"signer": p.address, "contractAddress": p.address, "tokenId": p.uint256, "expiration": p.uint256, "indexes": p.fixedSizeArray(p.uint256, 3), "pricePerDay": p.uint256, "rentalDays": p.uint256, "operator": p.address, "fingerprint": p.bytes32, "signature": p.bytes})}, ),
    bumpAssetIndex: fun("0xd409c9d6", "bumpAssetIndex(address,uint256)", {"_contractAddress": p.address, "_tokenId": p.uint256}, ),
    bumpContractIndex: fun("0x3788938b", "bumpContractIndex()", {}, ),
    bumpSignerIndex: fun("0x8adbc85d", "bumpSignerIndex()", {}, ),
    claim: fun("0x74725001", "claim(address[],uint256[])", {"_contractAddresses": p.array(p.address), "_tokenIds": p.array(p.uint256)}, ),
    executeMetaTransaction: fun("0xd8ed1acc", "executeMetaTransaction(address,bytes,bytes)", {"_userAddress": p.address, "_functionData": p.bytes, "_signature": p.bytes}, p.bytes),
    getAssetIndex: viewFun("0x2674ec7c", "getAssetIndex(address,uint256,address)", {"_contractAddress": p.address, "_tokenId": p.uint256, "_signer": p.address}, p.uint256),
    getContractIndex: viewFun("0x5cda3b5c", "getContractIndex()", {}, p.uint256),
    getFee: viewFun("0xced72f87", "getFee()", {}, p.uint256),
    getFeeCollector: viewFun("0x12fde4b7", "getFeeCollector()", {}, p.address),
    getIsRented: viewFun("0x1882497a", "getIsRented(address,uint256)", {"_contractAddress": p.address, "_tokenId": p.uint256}, p.bool),
    getNonce: viewFun("0x2d0335ab", "getNonce(address)", {"_signer": p.address}, p.uint256),
    getRental: viewFun("0x8729e422", "getRental(address,uint256)", {"_contractAddress": p.address, "_tokenId": p.uint256}, p.struct({"lessor": p.address, "tenant": p.address, "endDate": p.uint256})),
    getSignerIndex: viewFun("0x6e143720", "getSignerIndex(address)", {"_signer": p.address}, p.uint256),
    getToken: viewFun("0x21df0da7", "getToken()", {}, p.address),
    initialize: fun("0xcf756fdf", "initialize(address,address,address,uint256)", {"_owner": p.address, "_token": p.address, "_feeCollector": p.address, "_fee": p.uint256}, ),
    onERC721Received: fun("0x150b7a02", "onERC721Received(address,address,uint256,bytes)", {"_operator": p.address, "_1": p.address, "_tokenId": p.uint256, "_data": p.bytes}, p.bytes4),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    pause: fun("0x8456cb59", "pause()", {}, ),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    setFee: fun("0x69fe0e2d", "setFee(uint256)", {"_fee": p.uint256}, ),
    setFeeCollector: fun("0xa42dce80", "setFeeCollector(address)", {"_feeCollector": p.address}, ),
    setUpdateOperator: fun("0x37f81abb", "setUpdateOperator(address[],uint256[],address[])", {"_contractAddresses": p.array(p.address), "_tokenIds": p.array(p.uint256), "_operators": p.array(p.address)}, ),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
}

export class Contract extends ContractBase {

    getAssetIndex(_contractAddress: GetAssetIndexParams["_contractAddress"], _tokenId: GetAssetIndexParams["_tokenId"], _signer: GetAssetIndexParams["_signer"]) {
        return this.eth_call(functions.getAssetIndex, {_contractAddress, _tokenId, _signer})
    }

    getContractIndex() {
        return this.eth_call(functions.getContractIndex, {})
    }

    getFee() {
        return this.eth_call(functions.getFee, {})
    }

    getFeeCollector() {
        return this.eth_call(functions.getFeeCollector, {})
    }

    getIsRented(_contractAddress: GetIsRentedParams["_contractAddress"], _tokenId: GetIsRentedParams["_tokenId"]) {
        return this.eth_call(functions.getIsRented, {_contractAddress, _tokenId})
    }

    getNonce(_signer: GetNonceParams["_signer"]) {
        return this.eth_call(functions.getNonce, {_signer})
    }

    getRental(_contractAddress: GetRentalParams["_contractAddress"], _tokenId: GetRentalParams["_tokenId"]) {
        return this.eth_call(functions.getRental, {_contractAddress, _tokenId})
    }

    getSignerIndex(_signer: GetSignerIndexParams["_signer"]) {
        return this.eth_call(functions.getSignerIndex, {_signer})
    }

    getToken() {
        return this.eth_call(functions.getToken, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    paused() {
        return this.eth_call(functions.paused, {})
    }
}

/// Event types
export type AssetClaimedEventArgs = EParams<typeof events.AssetClaimed>
export type AssetIndexUpdatedEventArgs = EParams<typeof events.AssetIndexUpdated>
export type AssetRentedEventArgs = EParams<typeof events.AssetRented>
export type ContractIndexUpdatedEventArgs = EParams<typeof events.ContractIndexUpdated>
export type FeeCollectorUpdatedEventArgs = EParams<typeof events.FeeCollectorUpdated>
export type FeeUpdatedEventArgs = EParams<typeof events.FeeUpdated>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type MetaTransactionExecutedEventArgs = EParams<typeof events.MetaTransactionExecuted>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PausedEventArgs = EParams<typeof events.Paused>
export type SignerIndexUpdatedEventArgs = EParams<typeof events.SignerIndexUpdated>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>

/// Function types
export type AcceptListingParams = FunctionArguments<typeof functions.acceptListing>
export type AcceptListingReturn = FunctionReturn<typeof functions.acceptListing>

export type AcceptOfferParams = FunctionArguments<typeof functions.acceptOffer>
export type AcceptOfferReturn = FunctionReturn<typeof functions.acceptOffer>

export type BumpAssetIndexParams = FunctionArguments<typeof functions.bumpAssetIndex>
export type BumpAssetIndexReturn = FunctionReturn<typeof functions.bumpAssetIndex>

export type BumpContractIndexParams = FunctionArguments<typeof functions.bumpContractIndex>
export type BumpContractIndexReturn = FunctionReturn<typeof functions.bumpContractIndex>

export type BumpSignerIndexParams = FunctionArguments<typeof functions.bumpSignerIndex>
export type BumpSignerIndexReturn = FunctionReturn<typeof functions.bumpSignerIndex>

export type ClaimParams = FunctionArguments<typeof functions.claim>
export type ClaimReturn = FunctionReturn<typeof functions.claim>

export type ExecuteMetaTransactionParams = FunctionArguments<typeof functions.executeMetaTransaction>
export type ExecuteMetaTransactionReturn = FunctionReturn<typeof functions.executeMetaTransaction>

export type GetAssetIndexParams = FunctionArguments<typeof functions.getAssetIndex>
export type GetAssetIndexReturn = FunctionReturn<typeof functions.getAssetIndex>

export type GetContractIndexParams = FunctionArguments<typeof functions.getContractIndex>
export type GetContractIndexReturn = FunctionReturn<typeof functions.getContractIndex>

export type GetFeeParams = FunctionArguments<typeof functions.getFee>
export type GetFeeReturn = FunctionReturn<typeof functions.getFee>

export type GetFeeCollectorParams = FunctionArguments<typeof functions.getFeeCollector>
export type GetFeeCollectorReturn = FunctionReturn<typeof functions.getFeeCollector>

export type GetIsRentedParams = FunctionArguments<typeof functions.getIsRented>
export type GetIsRentedReturn = FunctionReturn<typeof functions.getIsRented>

export type GetNonceParams = FunctionArguments<typeof functions.getNonce>
export type GetNonceReturn = FunctionReturn<typeof functions.getNonce>

export type GetRentalParams = FunctionArguments<typeof functions.getRental>
export type GetRentalReturn = FunctionReturn<typeof functions.getRental>

export type GetSignerIndexParams = FunctionArguments<typeof functions.getSignerIndex>
export type GetSignerIndexReturn = FunctionReturn<typeof functions.getSignerIndex>

export type GetTokenParams = FunctionArguments<typeof functions.getToken>
export type GetTokenReturn = FunctionReturn<typeof functions.getToken>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type OnERC721ReceivedParams = FunctionArguments<typeof functions.onERC721Received>
export type OnERC721ReceivedReturn = FunctionReturn<typeof functions.onERC721Received>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type PausedParams = FunctionArguments<typeof functions.paused>
export type PausedReturn = FunctionReturn<typeof functions.paused>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SetFeeParams = FunctionArguments<typeof functions.setFee>
export type SetFeeReturn = FunctionReturn<typeof functions.setFee>

export type SetFeeCollectorParams = FunctionArguments<typeof functions.setFeeCollector>
export type SetFeeCollectorReturn = FunctionReturn<typeof functions.setFeeCollector>

export type SetUpdateOperatorParams = FunctionArguments<typeof functions.setUpdateOperator>
export type SetUpdateOperatorReturn = FunctionReturn<typeof functions.setUpdateOperator>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

