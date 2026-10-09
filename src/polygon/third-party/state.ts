import {
  Curation,
  LinkedContract,
  LinkedContracts,
  Metadata,
  MetadataType,
  Receipt,
  RegistryData,
  ThirdParty,
  ThirdPartyCount,
  ThirdPartyMetadata,
  ThirdPartyRootHistory,
} from '../../model'
import { sanitize } from '../../common/data'
import { EntityClass, LazyState } from '../../common/lazy-state'
import { ThirdPartyEvent } from './events'

const COUNT_ID = 'all'

/** Writes in foreign-key order. */
export const SAVE_ORDER: EntityClass<any>[] = [
  LinkedContracts,
  ThirdPartyMetadata,
  Metadata,
  ThirdParty,
  ThirdPartyRootHistory,
  Curation,
  Receipt,
  ThirdPartyCount,
  RegistryData,
]

export class ThirdPartyState extends LazyState {}

/** The subgraph's own lowercase: only A-Z change, as its AssemblyScript helper does. */
export function asciiLowerCase(value: string): string {
  let result = ''
  for (const char of value) {
    const code = char.charCodeAt(0)
    result += code > 64 && code < 91 ? String.fromCharCode(code + 32) : char
  }
  return result
}

/** A valid id looks like urn:decentraland:{network}:collections-thirdparty:{name}. */
export function isURNValid(urn: string): boolean {
  const parts = urn.split(':')
  return (
    parts.length === 5 &&
    parts[0] === 'urn' &&
    parts[1] === 'decentraland' &&
    (parts[3] === 'collections-thirdparty' || parts[3] === 'collections-linked-wearables')
  )
}

function resolverOrNull(resolver: string): string | null {
  return resolver.startsWith('https://') || resolver.startsWith('http://') ? sanitize(resolver) : null
}

/** An empty root is falsy in the subgraph, so a third party is only approved once it has a root. */
function approved(value: boolean, root: string): boolean {
  return value && root.length > 0
}

async function count(state: ThirdPartyState): Promise<ThirdPartyCount> {
  return (
    (await state.get(ThirdPartyCount, COUNT_ID)) ??
    new ThirdPartyCount({ id: COUNT_ID, thirdPartyTotal: 0n, receiptTotal: 0n, curationTotal: 0n })
  )
}

/** "tp:1:name:description[:network-address;network-address]" */
async function buildThirdPartyMetadata(state: ThirdPartyState, id: string, raw: string): Promise<ThirdPartyMetadata | null> {
  const data = raw.split(':')
  if (data.length > 5 || data.length < 4) {
    state.errors.push(`third party metadata ${id} is not correctly formatted`)
    return null
  }
  // graph-node returns an unset list of references as []; a new entity starts with it empty, and
  // an update without contracts keeps the previous ones.
  const metadata = (await state.get(ThirdPartyMetadata, id)) ?? new ThirdPartyMetadata({ id, contracts: [] })
  metadata.name = sanitize(data[2])
  metadata.description = sanitize(data[3])
  if (data.length === 5) {
    const contracts = new Map<string, LinkedContract>()
    for (const entry of data[4].split(';')) {
      const parts = entry.split('-')
      if (parts.length !== 2) {
        state.errors.push(`linked contract "${sanitize(entry)}" of ${id} is not correctly formatted`)
        continue
      }
      const contractId = sanitize(asciiLowerCase(parts[0] + '-' + parts[1]))
      let linked = await state.get(LinkedContracts, contractId)
      if (!linked) {
        linked = new LinkedContracts({
          id: contractId,
          network: sanitize(asciiLowerCase(parts[0])),
          address: sanitize(asciiLowerCase(parts[1])),
        })
        state.save(LinkedContracts, linked)
      }
      contracts.set(linked.id, new LinkedContract({ id: linked.id, network: linked.network, address: linked.address }))
    }
    // graph-node resolves a list of references as the referenced entities sorted by id, each once.
    // The ids are lowercase ASCII, so a code-unit sort matches its ordering.
    metadata.contracts = [...contracts.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }
  state.save(ThirdPartyMetadata, metadata)
  return metadata
}

async function buildMetadata(state: ThirdPartyState, id: string, raw: string): Promise<Metadata> {
  const metadata = (await state.get(Metadata, id)) ?? new Metadata({ id })
  if (raw.split(':')[0] === 'tp') {
    const thirdPartyMetadata = await buildThirdPartyMetadata(state, id, raw)
    if (thirdPartyMetadata) {
      metadata.thirdParty = thirdPartyMetadata
      metadata.type = MetadataType.third_party_v1
    } else {
      metadata.type = MetadataType.undefined
    }
  } else {
    metadata.type = MetadataType.undefined
  }
  state.save(Metadata, metadata)
  return metadata
}

/** Search fields come from the stored ThirdPartyMetadata, even when the latest metadata did not parse. */
async function setSearchFields(state: ThirdPartyState, thirdParty: ThirdParty) {
  const metadata = await state.get(ThirdPartyMetadata, thirdParty.id)
  if (!metadata) return
  thirdParty.searchName = metadata.name
  thirdParty.searchDescription = metadata.description
  thirdParty.searchText = asciiLowerCase(metadata.name + ' ' + metadata.description)
}

function rootHistory(state: ThirdPartyState, thirdParty: ThirdParty, ev: ThirdPartyEvent, eventName: string) {
  state.save(
    ThirdPartyRootHistory,
    new ThirdPartyRootHistory({
      id: `${ev.blockNumber}-${ev.logIndex}`,
      thirdParty,
      root: thirdParty.root,
      isApproved: thirdParty.isApproved ?? false,
      eventName,
      blockNumber: ev.blockNumber,
      logIndex: ev.logIndex,
      timestamp: ev.timestamp,
      transactionHash: ev.transactionHash,
    })
  )
}

/**
 * graph-node strips NUL characters from every string it stores, ids included, because Postgres text
 * cannot hold them. The subgraph validates and parses the raw strings first, so this module does
 * too, and strips only what it stores. A stored NUL would also fail the whole batch.
 */
export async function applyThirdPartyEvent(state: ThirdPartyState, ev: ThirdPartyEvent): Promise<void> {
  switch (ev.kind) {
    case 'ThirdPartyAdded': {
      if (!isURNValid(ev.thirdPartyId)) {
        state.errors.push(`third party added with an invalid URN: ${sanitize(ev.thirdPartyId)}`)
        return
      }
      const id = sanitize(ev.thirdPartyId)
      const thirdParty = (await state.get(ThirdParty, id)) ?? new ThirdParty({ id })
      thirdParty.root = ''
      thirdParty.consumedSlots = 0n
      thirdParty.isProgrammatic = ev.isProgrammatic
      thirdParty.resolver = resolverOrNull(ev.resolver)
      thirdParty.rawMetadata = sanitize(ev.metadata)
      thirdParty.maxItems = ev.itemSlots
      thirdParty.isApproved = approved(ev.isApproved, thirdParty.root)
      // The subgraph pops managers off the event array, which stores them in reverse order.
      thirdParty.managers = [...ev.managers].reverse()
      thirdParty.metadata = await buildMetadata(state, id, ev.metadata)
      await setSearchFields(state, thirdParty)
      state.save(ThirdParty, thirdParty)

      const c = await count(state)
      c.thirdPartyTotal += 1n
      state.save(ThirdPartyCount, c)
      return
    }
    case 'ThirdPartyUpdated': {
      if (!isURNValid(ev.thirdPartyId)) {
        state.errors.push(`third party updated with an invalid URN: ${sanitize(ev.thirdPartyId)}`)
        return
      }
      const thirdParty = await state.get(ThirdParty, sanitize(ev.thirdPartyId))
      if (!thirdParty) {
        state.errors.push(`invalid third party ${sanitize(ev.thirdPartyId)}`)
        return
      }
      thirdParty.resolver = resolverOrNull(ev.resolver)
      thirdParty.maxItems += ev.itemSlots
      thirdParty.rawMetadata = sanitize(ev.metadata)
      const managers = new Set(thirdParty.managers)
      ev.managers.forEach((manager, i) => {
        if (ev.managerValues[i]) managers.add(manager)
        else managers.delete(manager)
      })
      thirdParty.managers = [...managers]
      thirdParty.metadata = await buildMetadata(state, thirdParty.id, ev.metadata)
      await setSearchFields(state, thirdParty)
      state.save(ThirdParty, thirdParty)
      return
    }
    case 'ThirdPartyItemSlotsBought': {
      const thirdParty = await state.get(ThirdParty, sanitize(ev.thirdPartyId))
      if (!thirdParty) {
        state.errors.push(`unknown third party ${sanitize(ev.thirdPartyId)} bought item slots`)
        return
      }
      thirdParty.maxItems += ev.value
      state.save(ThirdParty, thirdParty)
      return
    }
    case 'ThirdPartyReviewedWithRoot': {
      const thirdParty = await state.get(ThirdParty, sanitize(ev.thirdPartyId))
      if (!thirdParty) {
        state.errors.push(`unknown third party ${sanitize(ev.thirdPartyId)} reviewed with root`)
        return
      }
      thirdParty.root = ev.root
      thirdParty.isApproved = approved(ev.isApproved, thirdParty.root)
      state.save(ThirdParty, thirdParty)
      rootHistory(state, thirdParty, ev, 'ThirdPartyReviewedWithRoot')
      return
    }
    case 'ThirdPartyReviewed': {
      const thirdParty = await state.get(ThirdParty, sanitize(ev.thirdPartyId))
      if (!thirdParty) {
        state.errors.push(`unknown third party ${sanitize(ev.thirdPartyId)} reviewed`)
        return
      }
      thirdParty.isApproved = approved(ev.value, thirdParty.root)
      state.save(ThirdParty, thirdParty)
      rootHistory(state, thirdParty, ev, 'ThirdPartyReviewed')
      return
    }
    case 'ItemSlotsConsumed': {
      const thirdParty = await state.get(ThirdParty, sanitize(ev.thirdPartyId))
      if (!thirdParty) {
        state.errors.push(`slots consumed for unknown third party ${sanitize(ev.thirdPartyId)}`)
        return
      }
      thirdParty.consumedSlots += ev.qty
      state.save(ThirdParty, thirdParty)

      let curation = await state.get(Curation, ev.sender)
      if (!curation) {
        curation = new Curation({ id: ev.sender, qty: 0n })
        const c = await count(state)
        c.curationTotal += 1n
        state.save(ThirdPartyCount, c)
      }
      curation.qty += ev.qty
      state.save(Curation, curation)

      const c = await count(state)
      c.receiptTotal += 1n
      state.save(ThirdPartyCount, c)

      state.save(
        Receipt,
        new Receipt({ id: ev.messageHash, qty: ev.qty, thirdParty, curation, signer: ev.signer, createdAt: ev.timestamp })
      )
      return
    }
    case 'ThirdPartyAggregatorSet': {
      const registry = (await state.get(RegistryData, '1')) ?? new RegistryData({ id: '1' })
      registry.aggregatorAddress = ev.newAggregator
      state.save(RegistryData, registry)
      return
    }
  }
}
