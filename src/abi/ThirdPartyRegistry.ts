import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AcceptedTokenSet: event("0x445f1d4a39b3dc9fd0f6ff6527b9a81ae56e9e252f7044d8d8003c846645117a", "AcceptedTokenSet(address,address)", {"_oldAcceptedToken": indexed(p.address), "_newAcceptedToken": indexed(p.address)}),
    CommitteeSet: event("0x526f01d990f9112502588ce703f53664ec8196974fb325ee8676a79b6aec5f10", "CommitteeSet(address,address)", {"_oldCommittee": indexed(p.address), "_newCommittee": indexed(p.address)}),
    FeesCollectorSet: event("0x58283f7e46512bbcb30558fa508283f23fac7be18fb20bfdf6d4bbf83c529d53", "FeesCollectorSet(address,address)", {"_oldFeesCollector": indexed(p.address), "_newFeesCollector": indexed(p.address)}),
    InitialItemValueSet: event("0x6262552fc8f7203b20c40996d15a1904fcca3b473aa9137635e9afb0fceea1c3", "InitialItemValueSet(bool,bool)", {"_oldInitialItemValue": p.bool, "_newInitialItemValue": p.bool}),
    InitialThirdPartyValueSet: event("0xa95f012e3b208b0a5a42a5afcd4105dc4739088109ef46b8cdcae84cfbe39b4f", "InitialThirdPartyValueSet(bool,bool)", {"_oldInitialThirdPartyValue": p.bool, "_newInitialThirdPartyValue": p.bool}),
    ItemReviewed: event("0x1089a7ab7995a900318e5edbe8e69db0951f28636b4107c96d1f2bf4ef35db69", "ItemReviewed(string,string,string,string,bool,address)", {"_thirdPartyId": p.string, "_itemId": p.string, "_metadata": p.string, "_contentHash": p.string, "_value": p.bool, "_sender": p.address}),
    ItemSlotPriceSet: event("0x07f81ede02be5aa71cf51c0fbd5c2b33f8e8f1c628334c60ad3dedbc3b72fe1a", "ItemSlotPriceSet(uint256,uint256)", {"_oldItemSlotPrice": p.uint256, "_newItemSlotPrice": p.uint256}),
    ItemSlotsConsumed: event("0x4c1b804d481a2c4b28401efe6ef27d5ade3c3df871e38094d86bc28ca4f7ced9", "ItemSlotsConsumed(string,uint256,address,bytes32,address)", {"_thirdPartyId": p.string, "_qty": p.uint256, "_signer": indexed(p.address), "_messageHash": p.bytes32, "_sender": indexed(p.address)}),
    MetaTransactionExecuted: event("0x5845892132946850460bff5a0083f71031bc5bf9aadcd40f1de79423eac9b10b", "MetaTransactionExecuted(address,address,bytes)", {"userAddress": p.address, "relayerAddress": p.address, "functionSignature": p.bytes}),
    OracleSet: event("0xc1d3048301c0d23629a2532c8defa6d68f8e1a0e4157918769e9fb1b2eeb888e", "OracleSet(address,address)", {"_oldOracle": indexed(p.address), "_newOracle": indexed(p.address)}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    ProgrammaticBasePurchasedSlotsSet: event("0x2c80cd6858495b32e1755720f7990237cb736214e7937da49d81ce50b52fb920", "ProgrammaticBasePurchasedSlotsSet(uint256,uint256)", {"_oldProgrammaticBasePurchasedSlots": p.uint256, "_newProgrammaticBasePurchasedSlots": p.uint256}),
    'ThirdPartyAdded(string,string,string,bool,address[],uint256,bool,address)': event("0x6414aa1e313e333a2c7d725d1d9a97e35a72cc1afee753ca0c689cb1b4b51ee8", "ThirdPartyAdded(string,string,string,bool,address[],uint256,bool,address)", {"_thirdPartyId": p.string, "_metadata": p.string, "_resolver": p.string, "_isApproved": p.bool, "_managers": p.array(p.address), "_itemSlots": p.uint256, "_isProgrammatic": p.bool, "_sender": p.address}),
    'ThirdPartyAdded(string,string,string,bool,address[],uint256,address)': event("0xac77942d9841aa600cfaefecbbf0cc3274a189d24e2077edd44e02eaafc09da8", "ThirdPartyAdded(string,string,string,bool,address[],uint256,address)", {"_thirdPartyId": p.string, "_metadata": p.string, "_resolver": p.string, "_isApproved": p.bool, "_managers": p.array(p.address), "_itemSlots": p.uint256, "_sender": p.address}),
    ThirdPartyAggregatorSet: event("0x8c701b8991bb165f789a536f94c965d6883b229228b741cd3ccd07e7531c9e3c", "ThirdPartyAggregatorSet(address,address)", {"_oldThirdPartyAggregator": indexed(p.address), "_newThirdPartyAggregator": indexed(p.address)}),
    ThirdPartyItemSlotsBought: event("0x54071c0400de99d3cf7af0a3ed4c907e883ea09b8ac5b997b56dc146b2208304", "ThirdPartyItemSlotsBought(string,uint256,uint256,address)", {"_thirdPartyId": p.string, "_price": p.uint256, "_value": p.uint256, "_sender": p.address}),
    ThirdPartyReviewed: event("0x034b4b22e36d45e8c10ce1d9030ff3789a890b651984a94d9482ed600ec715a2", "ThirdPartyReviewed(string,bool,address)", {"_thirdPartyId": p.string, "_value": p.bool, "_sender": p.address}),
    ThirdPartyReviewedWithRoot: event("0xa72e2b6c0b2d7d0a5ec1bb1325b9692443b26f7d46764fb5272ed3d24b1075a6", "ThirdPartyReviewedWithRoot(string,bytes32,bool,address)", {"_thirdPartyId": p.string, "_root": p.bytes32, "_isApproved": p.bool, "_sender": p.address}),
    ThirdPartyRuleAdded: event("0xe6f7ac61884a13fb0259be5acab8215f630da0297286248b57792d61d515c34d", "ThirdPartyRuleAdded(string,string,bool,address)", {"_thirdPartyId": p.string, "_rule": p.string, "_value": p.bool, "_sender": p.address}),
    ThirdPartyUpdated: event("0x02aee6e58d7cab3dd7a9d8955daf7d828729ad4d3ccf4ab4a11cd5d9f2c210f9", "ThirdPartyUpdated(string,string,string,address[],bool[],uint256,address)", {"_thirdPartyId": p.string, "_metadata": p.string, "_resolver": p.string, "_managers": p.array(p.address), "_managerValues": p.array(p.bool), "_itemSlots": p.uint256, "_sender": p.address}),
}

export const functions = {
    acceptedToken: viewFun("0x451c3d80", "acceptedToken()", {}, p.address),
    addThirdParties: fun("0xdb9aa95c", "addThirdParties((string,string,string,address[],bool[],uint256)[],bool[],uint256[])", {"_thirdParties": p.array(p.struct({"id": p.string, "metadata": p.string, "resolver": p.string, "managers": p.array(p.address), "managerValues": p.array(p.bool), "slots": p.uint256})), "_areProgrammatic": p.array(p.bool), "_maxPrices": p.array(p.uint256)}, ),
    buyItemSlots: fun("0xd8f0f3c1", "buyItemSlots(string,uint256,uint256)", {"_thirdPartyId": p.string, "_qty": p.uint256, "_maxPrice": p.uint256}, ),
    committee: viewFun("0xd864e740", "committee()", {}, p.address),
    consumeSlots: fun("0x4095a515", "consumeSlots(string,(uint256,bytes32,bytes32,bytes32,uint8)[])", {"_thirdPartyId": p.string, "_consumeSlotsParams": p.array(p.struct({"qty": p.uint256, "salt": p.bytes32, "sigR": p.bytes32, "sigS": p.bytes32, "sigV": p.uint8}))}, ),
    domainSeparator: viewFun("0xf698da25", "domainSeparator()", {}, p.bytes32),
    executeMetaTransaction: fun("0x0c53c51c", "executeMetaTransaction(address,bytes,bytes32,bytes32,uint8)", {"userAddress": p.address, "functionSignature": p.bytes, "sigR": p.bytes32, "sigS": p.bytes32, "sigV": p.uint8}, p.bytes),
    feesCollector: viewFun("0x9cf160f6", "feesCollector()", {}, p.address),
    getChainId: viewFun("0x3408e470", "getChainId()", {}, p.uint256),
    getNonce: viewFun("0x2d0335ab", "getNonce(address)", {"user": p.address}, p.uint256),
    getRuleValue: viewFun("0xf9a8d411", "getRuleValue(string,string)", {"_thirdPartyId": p.string, "_rule": p.string}, p.bool),
    initialItemValue: viewFun("0x209c7ce6", "initialItemValue()", {}, p.bool),
    initialThirdPartyValue: viewFun("0x374b879f", "initialThirdPartyValue()", {}, p.bool),
    initialize: fun("0x1460e390", "initialize(address,address,address,address,address,address,uint256)", {"_owner": p.address, "_thirdPartyAggregator": p.address, "_feesCollector": p.address, "_committee": p.address, "_acceptedToken": p.address, "_oracle": p.address, "_itemSlotPrice": p.uint256}, ),
    isThirdPartyManager: viewFun("0x3b40f0b1", "isThirdPartyManager(string,address)", {"_thirdPartyId": p.string, "_manager": p.address}, p.bool),
    isThirdPartyProgrammatic: viewFun("0xf65d42bd", "isThirdPartyProgrammatic(string)", {"_0": p.string}, p.bool),
    itemIdByIndex: viewFun("0xf04b490e", "itemIdByIndex(string,uint256)", {"_thirdPartyId": p.string, "_index": p.uint256}, p.string),
    itemSlotPrice: viewFun("0xb28ddceb", "itemSlotPrice()", {}, p.uint256),
    itemsById: viewFun("0xe068a4e2", "itemsById(string,string)", {"_thirdPartyId": p.string, "_itemId": p.string}, p.struct({"metadata": p.string, "contentHash": p.string, "isApproved": p.bool, "registered": p.uint256})),
    itemsCount: viewFun("0xfc219c86", "itemsCount(string)", {"_thirdPartyId": p.string}, p.uint256),
    oracle: viewFun("0x7dc0d1d0", "oracle()", {}, p.address),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    programmaticBasePurchasedSlots: viewFun("0x9834f28a", "programmaticBasePurchasedSlots()", {}, p.uint256),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    reviewThirdParties: fun("0x39276e37", "reviewThirdParties((string,bool,(string,string,string,bool)[])[])", {"_thirdParties": p.array(p.struct({"id": p.string, "value": p.bool, "items": p.array(p.struct({"id": p.string, "metadata": p.string, "contentHash": p.string, "value": p.bool}))}))}, ),
    reviewThirdPartyWithRoot: fun("0x3cb681b0", "reviewThirdPartyWithRoot(string,bytes32,(uint256,bytes32,bytes32,bytes32,uint8)[])", {"_thirdPartyId": p.string, "_root": p.bytes32, "_consumeSlotsParams": p.array(p.struct({"qty": p.uint256, "salt": p.bytes32, "sigR": p.bytes32, "sigS": p.bytes32, "sigV": p.uint8}))}, ),
    setAcceptedToken: fun("0x7487f528", "setAcceptedToken(address)", {"_newAcceptedToken": p.address}, ),
    setCommittee: fun("0xbddae40e", "setCommittee(address)", {"_newCommittee": p.address}, ),
    setFeesCollector: fun("0x373071f2", "setFeesCollector(address)", {"_newFeesCollector": p.address}, ),
    setInitialItemValue: fun("0x195a1f37", "setInitialItemValue(bool)", {"_newinitialItemValue": p.bool}, ),
    setInitialThirdPartyValue: fun("0xe14b2654", "setInitialThirdPartyValue(bool)", {"_newinitialThirdPartyValue": p.bool}, ),
    setItemSlotPrice: fun("0x08be0a4c", "setItemSlotPrice(uint256)", {"_newItemSlotPrice": p.uint256}, ),
    setOracle: fun("0x7adbf973", "setOracle(address)", {"_newOracle": p.address}, ),
    setProgrammaticBasePurchasedSlots: fun("0x97da1549", "setProgrammaticBasePurchasedSlots(uint256)", {"_value": p.uint256}, ),
    setRules: fun("0x8c25791e", "setRules(string,string[],bool[])", {"_thirdPartyId": p.string, "_rules": p.array(p.string), "_values": p.array(p.bool)}, ),
    setThirdPartyAggregator: fun("0xf668099a", "setThirdPartyAggregator(address)", {"_newThirdPartyAggregator": p.address}, ),
    thirdParties: viewFun("0x4d61ca78", "thirdParties(string)", {"_0": p.string}, {"isApproved": p.bool, "root": p.bytes32, "maxItems": p.uint256, "consumedSlots": p.uint256, "registered": p.uint256, "metadata": p.string, "resolver": p.string}),
    thirdPartiesCount: viewFun("0x7204b534", "thirdPartiesCount()", {}, p.uint256),
    thirdPartyAggregator: viewFun("0x6eb83238", "thirdPartyAggregator()", {}, p.address),
    thirdPartyIds: viewFun("0xba6c2c42", "thirdPartyIds(uint256)", {"_0": p.uint256}, p.string),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    updateThirdParties: fun("0x7c08ba09", "updateThirdParties((string,string,string,address[],bool[],uint256)[])", {"_thirdParties": p.array(p.struct({"id": p.string, "metadata": p.string, "resolver": p.string, "managers": p.array(p.address), "managerValues": p.array(p.bool), "slots": p.uint256}))}, ),
}

export class Contract extends ContractBase {

    acceptedToken() {
        return this.eth_call(functions.acceptedToken, {})
    }

    committee() {
        return this.eth_call(functions.committee, {})
    }

    domainSeparator() {
        return this.eth_call(functions.domainSeparator, {})
    }

    feesCollector() {
        return this.eth_call(functions.feesCollector, {})
    }

    getChainId() {
        return this.eth_call(functions.getChainId, {})
    }

    getNonce(user: GetNonceParams["user"]) {
        return this.eth_call(functions.getNonce, {user})
    }

    getRuleValue(_thirdPartyId: GetRuleValueParams["_thirdPartyId"], _rule: GetRuleValueParams["_rule"]) {
        return this.eth_call(functions.getRuleValue, {_thirdPartyId, _rule})
    }

    initialItemValue() {
        return this.eth_call(functions.initialItemValue, {})
    }

    initialThirdPartyValue() {
        return this.eth_call(functions.initialThirdPartyValue, {})
    }

    isThirdPartyManager(_thirdPartyId: IsThirdPartyManagerParams["_thirdPartyId"], _manager: IsThirdPartyManagerParams["_manager"]) {
        return this.eth_call(functions.isThirdPartyManager, {_thirdPartyId, _manager})
    }

    isThirdPartyProgrammatic(_0: IsThirdPartyProgrammaticParams["_0"]) {
        return this.eth_call(functions.isThirdPartyProgrammatic, {_0})
    }

    itemIdByIndex(_thirdPartyId: ItemIdByIndexParams["_thirdPartyId"], _index: ItemIdByIndexParams["_index"]) {
        return this.eth_call(functions.itemIdByIndex, {_thirdPartyId, _index})
    }

    itemSlotPrice() {
        return this.eth_call(functions.itemSlotPrice, {})
    }

    itemsById(_thirdPartyId: ItemsByIdParams["_thirdPartyId"], _itemId: ItemsByIdParams["_itemId"]) {
        return this.eth_call(functions.itemsById, {_thirdPartyId, _itemId})
    }

    itemsCount(_thirdPartyId: ItemsCountParams["_thirdPartyId"]) {
        return this.eth_call(functions.itemsCount, {_thirdPartyId})
    }

    oracle() {
        return this.eth_call(functions.oracle, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    programmaticBasePurchasedSlots() {
        return this.eth_call(functions.programmaticBasePurchasedSlots, {})
    }

    thirdParties(_0: ThirdPartiesParams["_0"]) {
        return this.eth_call(functions.thirdParties, {_0})
    }

    thirdPartiesCount() {
        return this.eth_call(functions.thirdPartiesCount, {})
    }

    thirdPartyAggregator() {
        return this.eth_call(functions.thirdPartyAggregator, {})
    }

    thirdPartyIds(_0: ThirdPartyIdsParams["_0"]) {
        return this.eth_call(functions.thirdPartyIds, {_0})
    }
}

/// Event types
export type AcceptedTokenSetEventArgs = EParams<typeof events.AcceptedTokenSet>
export type CommitteeSetEventArgs = EParams<typeof events.CommitteeSet>
export type FeesCollectorSetEventArgs = EParams<typeof events.FeesCollectorSet>
export type InitialItemValueSetEventArgs = EParams<typeof events.InitialItemValueSet>
export type InitialThirdPartyValueSetEventArgs = EParams<typeof events.InitialThirdPartyValueSet>
export type ItemReviewedEventArgs = EParams<typeof events.ItemReviewed>
export type ItemSlotPriceSetEventArgs = EParams<typeof events.ItemSlotPriceSet>
export type ItemSlotsConsumedEventArgs = EParams<typeof events.ItemSlotsConsumed>
export type MetaTransactionExecutedEventArgs = EParams<typeof events.MetaTransactionExecuted>
export type OracleSetEventArgs = EParams<typeof events.OracleSet>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type ProgrammaticBasePurchasedSlotsSetEventArgs = EParams<typeof events.ProgrammaticBasePurchasedSlotsSet>
export type ThirdPartyAddedEventArgs_0 = EParams<typeof events['ThirdPartyAdded(string,string,string,bool,address[],uint256,bool,address)']>
export type ThirdPartyAddedEventArgs_1 = EParams<typeof events['ThirdPartyAdded(string,string,string,bool,address[],uint256,address)']>
export type ThirdPartyAggregatorSetEventArgs = EParams<typeof events.ThirdPartyAggregatorSet>
export type ThirdPartyItemSlotsBoughtEventArgs = EParams<typeof events.ThirdPartyItemSlotsBought>
export type ThirdPartyReviewedEventArgs = EParams<typeof events.ThirdPartyReviewed>
export type ThirdPartyReviewedWithRootEventArgs = EParams<typeof events.ThirdPartyReviewedWithRoot>
export type ThirdPartyRuleAddedEventArgs = EParams<typeof events.ThirdPartyRuleAdded>
export type ThirdPartyUpdatedEventArgs = EParams<typeof events.ThirdPartyUpdated>

/// Function types
export type AcceptedTokenParams = FunctionArguments<typeof functions.acceptedToken>
export type AcceptedTokenReturn = FunctionReturn<typeof functions.acceptedToken>

export type AddThirdPartiesParams = FunctionArguments<typeof functions.addThirdParties>
export type AddThirdPartiesReturn = FunctionReturn<typeof functions.addThirdParties>

export type BuyItemSlotsParams = FunctionArguments<typeof functions.buyItemSlots>
export type BuyItemSlotsReturn = FunctionReturn<typeof functions.buyItemSlots>

export type CommitteeParams = FunctionArguments<typeof functions.committee>
export type CommitteeReturn = FunctionReturn<typeof functions.committee>

export type ConsumeSlotsParams = FunctionArguments<typeof functions.consumeSlots>
export type ConsumeSlotsReturn = FunctionReturn<typeof functions.consumeSlots>

export type DomainSeparatorParams = FunctionArguments<typeof functions.domainSeparator>
export type DomainSeparatorReturn = FunctionReturn<typeof functions.domainSeparator>

export type ExecuteMetaTransactionParams = FunctionArguments<typeof functions.executeMetaTransaction>
export type ExecuteMetaTransactionReturn = FunctionReturn<typeof functions.executeMetaTransaction>

export type FeesCollectorParams = FunctionArguments<typeof functions.feesCollector>
export type FeesCollectorReturn = FunctionReturn<typeof functions.feesCollector>

export type GetChainIdParams = FunctionArguments<typeof functions.getChainId>
export type GetChainIdReturn = FunctionReturn<typeof functions.getChainId>

export type GetNonceParams = FunctionArguments<typeof functions.getNonce>
export type GetNonceReturn = FunctionReturn<typeof functions.getNonce>

export type GetRuleValueParams = FunctionArguments<typeof functions.getRuleValue>
export type GetRuleValueReturn = FunctionReturn<typeof functions.getRuleValue>

export type InitialItemValueParams = FunctionArguments<typeof functions.initialItemValue>
export type InitialItemValueReturn = FunctionReturn<typeof functions.initialItemValue>

export type InitialThirdPartyValueParams = FunctionArguments<typeof functions.initialThirdPartyValue>
export type InitialThirdPartyValueReturn = FunctionReturn<typeof functions.initialThirdPartyValue>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type IsThirdPartyManagerParams = FunctionArguments<typeof functions.isThirdPartyManager>
export type IsThirdPartyManagerReturn = FunctionReturn<typeof functions.isThirdPartyManager>

export type IsThirdPartyProgrammaticParams = FunctionArguments<typeof functions.isThirdPartyProgrammatic>
export type IsThirdPartyProgrammaticReturn = FunctionReturn<typeof functions.isThirdPartyProgrammatic>

export type ItemIdByIndexParams = FunctionArguments<typeof functions.itemIdByIndex>
export type ItemIdByIndexReturn = FunctionReturn<typeof functions.itemIdByIndex>

export type ItemSlotPriceParams = FunctionArguments<typeof functions.itemSlotPrice>
export type ItemSlotPriceReturn = FunctionReturn<typeof functions.itemSlotPrice>

export type ItemsByIdParams = FunctionArguments<typeof functions.itemsById>
export type ItemsByIdReturn = FunctionReturn<typeof functions.itemsById>

export type ItemsCountParams = FunctionArguments<typeof functions.itemsCount>
export type ItemsCountReturn = FunctionReturn<typeof functions.itemsCount>

export type OracleParams = FunctionArguments<typeof functions.oracle>
export type OracleReturn = FunctionReturn<typeof functions.oracle>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type ProgrammaticBasePurchasedSlotsParams = FunctionArguments<typeof functions.programmaticBasePurchasedSlots>
export type ProgrammaticBasePurchasedSlotsReturn = FunctionReturn<typeof functions.programmaticBasePurchasedSlots>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type ReviewThirdPartiesParams = FunctionArguments<typeof functions.reviewThirdParties>
export type ReviewThirdPartiesReturn = FunctionReturn<typeof functions.reviewThirdParties>

export type ReviewThirdPartyWithRootParams = FunctionArguments<typeof functions.reviewThirdPartyWithRoot>
export type ReviewThirdPartyWithRootReturn = FunctionReturn<typeof functions.reviewThirdPartyWithRoot>

export type SetAcceptedTokenParams = FunctionArguments<typeof functions.setAcceptedToken>
export type SetAcceptedTokenReturn = FunctionReturn<typeof functions.setAcceptedToken>

export type SetCommitteeParams = FunctionArguments<typeof functions.setCommittee>
export type SetCommitteeReturn = FunctionReturn<typeof functions.setCommittee>

export type SetFeesCollectorParams = FunctionArguments<typeof functions.setFeesCollector>
export type SetFeesCollectorReturn = FunctionReturn<typeof functions.setFeesCollector>

export type SetInitialItemValueParams = FunctionArguments<typeof functions.setInitialItemValue>
export type SetInitialItemValueReturn = FunctionReturn<typeof functions.setInitialItemValue>

export type SetInitialThirdPartyValueParams = FunctionArguments<typeof functions.setInitialThirdPartyValue>
export type SetInitialThirdPartyValueReturn = FunctionReturn<typeof functions.setInitialThirdPartyValue>

export type SetItemSlotPriceParams = FunctionArguments<typeof functions.setItemSlotPrice>
export type SetItemSlotPriceReturn = FunctionReturn<typeof functions.setItemSlotPrice>

export type SetOracleParams = FunctionArguments<typeof functions.setOracle>
export type SetOracleReturn = FunctionReturn<typeof functions.setOracle>

export type SetProgrammaticBasePurchasedSlotsParams = FunctionArguments<typeof functions.setProgrammaticBasePurchasedSlots>
export type SetProgrammaticBasePurchasedSlotsReturn = FunctionReturn<typeof functions.setProgrammaticBasePurchasedSlots>

export type SetRulesParams = FunctionArguments<typeof functions.setRules>
export type SetRulesReturn = FunctionReturn<typeof functions.setRules>

export type SetThirdPartyAggregatorParams = FunctionArguments<typeof functions.setThirdPartyAggregator>
export type SetThirdPartyAggregatorReturn = FunctionReturn<typeof functions.setThirdPartyAggregator>

export type ThirdPartiesParams = FunctionArguments<typeof functions.thirdParties>
export type ThirdPartiesReturn = FunctionReturn<typeof functions.thirdParties>

export type ThirdPartiesCountParams = FunctionArguments<typeof functions.thirdPartiesCount>
export type ThirdPartiesCountReturn = FunctionReturn<typeof functions.thirdPartiesCount>

export type ThirdPartyAggregatorParams = FunctionArguments<typeof functions.thirdPartyAggregator>
export type ThirdPartyAggregatorReturn = FunctionReturn<typeof functions.thirdPartyAggregator>

export type ThirdPartyIdsParams = FunctionArguments<typeof functions.thirdPartyIds>
export type ThirdPartyIdsReturn = FunctionReturn<typeof functions.thirdPartyIds>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UpdateThirdPartiesParams = FunctionArguments<typeof functions.updateThirdParties>
export type UpdateThirdPartiesReturn = FunctionReturn<typeof functions.updateThirdParties>

