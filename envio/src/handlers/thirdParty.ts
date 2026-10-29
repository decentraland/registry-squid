// Third-party (linked wearables) registry: ThirdPartyRegistry on Polygon.
// A port of the squid's src/polygon/third-party/state.ts, which mirrors tpr-graph.

import { indexer, type EvmOnEventContext, type ThirdParty, type ThirdPartyCount, type ThirdPartyMetadata } from 'envio'
import { sanitize } from '../common/land.js'

type Ctx = EvmOnEventContext

const COUNT_ID = 'all'
const FIELDS = { block: ['timestamp'], transaction: ['hash'] } as const

interface LinkedContract {
  id: string
  network: string
  address: string
}

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

function resolverOrNull(resolver: string): string | undefined {
  return resolver.startsWith('https://') || resolver.startsWith('http://') ? sanitize(resolver) : undefined
}

/** An empty root is falsy in the subgraph, so a third party is only approved once it has a root. */
function approved(value: boolean, root: string): boolean {
  return value && root.length > 0
}

async function count(context: Ctx): Promise<ThirdPartyCount> {
  return (await context.ThirdPartyCount.get(COUNT_ID)) ?? { id: COUNT_ID, thirdPartyTotal: 0n, receiptTotal: 0n, curationTotal: 0n }
}

/** "tp:1:name:description[:network-address;network-address]" */
async function buildThirdPartyMetadata(context: Ctx, id: string, raw: string): Promise<ThirdPartyMetadata | null> {
  const data = raw.split(':')
  if (data.length > 5 || data.length < 4) {
    context.log.warn(`third party metadata ${id} is not correctly formatted`)
    return null
  }
  // A new entity starts with no contracts; an update without contracts keeps the previous ones.
  const found = await context.ThirdPartyMetadata.get(id)
  let contracts = (found?.contracts as LinkedContract[] | undefined) ?? []
  if (data.length === 5) {
    const byId = new Map<string, LinkedContract>()
    for (const entry of data[4]!.split(';')) {
      const parts = entry.split('-')
      if (parts.length !== 2) {
        context.log.warn(`linked contract "${sanitize(entry)}" of ${id} is not correctly formatted`)
        continue
      }
      const contractId = sanitize(asciiLowerCase(parts[0] + '-' + parts[1]))
      let linked = await context.LinkedContracts.get(contractId)
      if (!linked) {
        linked = {
          id: contractId,
          network: sanitize(asciiLowerCase(parts[0]!)),
          address: sanitize(asciiLowerCase(parts[1]!)),
        }
        context.LinkedContracts.set(linked)
      }
      byId.set(linked.id, { id: linked.id, network: linked.network, address: linked.address })
    }
    // graph-node resolves a list of references sorted by id, each once.
    contracts = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }
  const metadata: ThirdPartyMetadata = {
    id,
    name: sanitize(data[2]!),
    description: sanitize(data[3]!),
    contracts: contracts as unknown as ThirdPartyMetadata['contracts'],
  }
  context.ThirdPartyMetadata.set(metadata)
  return metadata
}

/** Returns the Metadata id, and the ThirdPartyMetadata this call stored, if any. */
async function buildMetadata(context: Ctx, id: string, raw: string): Promise<{ id: string; stored: ThirdPartyMetadata | null }> {
  const found = await context.Metadata.get(id)
  let thirdParty_id = found?.thirdParty_id
  let type: 'undefined' | 'third_party_v1' = 'undefined'
  let stored: ThirdPartyMetadata | null = null
  if (raw.split(':')[0] === 'tp') {
    stored = await buildThirdPartyMetadata(context, id, raw)
    if (stored) {
      thirdParty_id = stored.id
      type = 'third_party_v1'
    }
  }
  context.Metadata.set({ id, type, thirdParty_id })
  return { id, stored }
}

/** Search fields come from the stored ThirdPartyMetadata, even when the latest metadata did not parse. */
async function searchFields(context: Ctx, thirdParty: ThirdParty, stored: ThirdPartyMetadata | null) {
  const metadata = stored ?? (await context.ThirdPartyMetadata.get(thirdParty.id))
  if (!metadata) return {}
  // An empty value reads null, as in the subgraph.
  return {
    searchName: metadata.name || undefined,
    searchDescription: metadata.description || undefined,
    searchText: asciiLowerCase(metadata.name + ' ' + metadata.description),
  }
}

/**
 * graph-node keeps nothing of what the subgraph does for an id holding a NUL character, so
 * events on such an id are skipped whole (see the squid's state.ts).
 */
function hasNul(context: Ctx, kind: string, thirdPartyId: string): boolean {
  if (!thirdPartyId.includes('\u0000')) return false
  context.log.warn(`${kind} on a third party id with a NUL character: ${sanitize(thirdPartyId)}`)
  return true
}

async function thirdPartyAdded(
  context: Ctx,
  ev: { thirdPartyId: string; metadata: string; resolver: string; isApproved: boolean; managers: readonly string[]; itemSlots: bigint; isProgrammatic: boolean }
) {
  if (hasNul(context, 'ThirdPartyAdded', ev.thirdPartyId)) return
  if (!isURNValid(ev.thirdPartyId)) {
    context.log.warn(`third party added with an invalid URN: ${sanitize(ev.thirdPartyId)}`)
    return
  }
  const id = sanitize(ev.thirdPartyId)
  const found = await context.ThirdParty.get(id)
  const root = ''
  const metadata = await buildMetadata(context, id, ev.metadata)
  const base: ThirdParty = {
    id,
    searchName: undefined,
    searchDescription: undefined,
    searchText: undefined,
    ...found,
    root,
    consumedSlots: 0n,
    isProgrammatic: ev.isProgrammatic,
    resolver: resolverOrNull(ev.resolver),
    rawMetadata: sanitize(ev.metadata),
    maxItems: ev.itemSlots,
    isApproved: approved(ev.isApproved, root),
    // The subgraph pops managers off the event array, which stores them in reverse order.
    managers: ev.managers.map((a) => a.toLowerCase()).reverse(),
    metadata_id: metadata.id,
  }
  context.ThirdParty.set({ ...base, ...(await searchFields(context, base, metadata.stored)) })
  const c = await count(context)
  context.ThirdPartyCount.set({ ...c, thirdPartyTotal: c.thirdPartyTotal + 1n })
}

indexer.onEvent({ contract: 'ThirdPartyRegistry', event: 'ThirdPartyAdded' }, async ({ event, context }) => {
  const p = event.params
  await thirdPartyAdded(context, {
    thirdPartyId: p._thirdPartyId,
    metadata: p._metadata,
    resolver: p._resolver,
    isApproved: p._isApproved,
    managers: p._managers,
    itemSlots: p._itemSlots,
    isProgrammatic: p._isProgrammatic,
  })
})

indexer.onEvent({ contract: 'ThirdPartyRegistry', event: 'ThirdPartyAddedLegacy' }, async ({ event, context }) => {
  const p = event.params
  await thirdPartyAdded(context, {
    thirdPartyId: p._thirdPartyId,
    metadata: p._metadata,
    resolver: p._resolver,
    isApproved: p._isApproved,
    managers: p._managers,
    itemSlots: p._itemSlots,
    isProgrammatic: false,
  })
})

indexer.onEvent({ contract: 'ThirdPartyRegistry', event: 'ThirdPartyUpdated' }, async ({ event, context }) => {
  const p = event.params
  if (hasNul(context, 'ThirdPartyUpdated', p._thirdPartyId)) return
  if (!isURNValid(p._thirdPartyId)) {
    context.log.warn(`third party updated with an invalid URN: ${sanitize(p._thirdPartyId)}`)
    return
  }
  const thirdParty = await context.ThirdParty.get(sanitize(p._thirdPartyId))
  if (!thirdParty) {
    context.log.warn(`invalid third party ${sanitize(p._thirdPartyId)}`)
    return
  }
  const managers = new Set(thirdParty.managers)
  p._managers.forEach((manager, i) => {
    if (p._managerValues[i]) managers.add(manager.toLowerCase())
    else managers.delete(manager.toLowerCase())
  })
  const metadata = await buildMetadata(context, thirdParty.id, p._metadata)
  const next: ThirdParty = {
    ...thirdParty,
    resolver: resolverOrNull(p._resolver),
    maxItems: thirdParty.maxItems + p._itemSlots,
    rawMetadata: sanitize(p._metadata),
    managers: [...managers],
    metadata_id: metadata.id,
  }
  context.ThirdParty.set({ ...next, ...(await searchFields(context, next, metadata.stored)) })
})

indexer.onEvent({ contract: 'ThirdPartyRegistry', event: 'ThirdPartyItemSlotsBought' }, async ({ event, context }) => {
  const p = event.params
  if (hasNul(context, 'ThirdPartyItemSlotsBought', p._thirdPartyId)) return
  const thirdParty = await context.ThirdParty.get(sanitize(p._thirdPartyId))
  if (!thirdParty) {
    context.log.warn(`unknown third party ${sanitize(p._thirdPartyId)} bought item slots`)
    return
  }
  context.ThirdParty.set({ ...thirdParty, maxItems: thirdParty.maxItems + p._value })
})

function rootHistory(
  context: Ctx,
  thirdParty: ThirdParty,
  event: { block: { number: number; timestamp: number }; logIndex: number; transaction: { hash: string } },
  eventName: string
) {
  context.ThirdPartyRootHistory.set({
    id: `${event.block.number}-${event.logIndex}`,
    thirdParty_id: thirdParty.id,
    root: thirdParty.root,
    isApproved: thirdParty.isApproved ?? false,
    eventName,
    blockNumber: event.block.number,
    logIndex: event.logIndex,
    timestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  })
}

indexer.onEvent({ contract: 'ThirdPartyRegistry', event: 'ThirdPartyReviewedWithRoot', fields: FIELDS }, async ({ event, context }) => {
  const p = event.params
  if (hasNul(context, 'ThirdPartyReviewedWithRoot', p._thirdPartyId)) return
  const thirdParty = await context.ThirdParty.get(sanitize(p._thirdPartyId))
  if (!thirdParty) {
    context.log.warn(`unknown third party ${sanitize(p._thirdPartyId)} reviewed with root`)
    return
  }
  const root = p._root.toLowerCase()
  const next = { ...thirdParty, root, isApproved: approved(p._isApproved, root) }
  context.ThirdParty.set(next)
  rootHistory(context, next, event, 'ThirdPartyReviewedWithRoot')
})

indexer.onEvent({ contract: 'ThirdPartyRegistry', event: 'ThirdPartyReviewed', fields: FIELDS }, async ({ event, context }) => {
  const p = event.params
  if (hasNul(context, 'ThirdPartyReviewed', p._thirdPartyId)) return
  const thirdParty = await context.ThirdParty.get(sanitize(p._thirdPartyId))
  if (!thirdParty) {
    context.log.warn(`unknown third party ${sanitize(p._thirdPartyId)} reviewed`)
    return
  }
  const next = { ...thirdParty, isApproved: approved(p._value, thirdParty.root) }
  context.ThirdParty.set(next)
  rootHistory(context, next, event, 'ThirdPartyReviewed')
})

indexer.onEvent({ contract: 'ThirdPartyRegistry', event: 'ItemSlotsConsumed', fields: FIELDS }, async ({ event, context }) => {
  const p = event.params
  if (hasNul(context, 'ItemSlotsConsumed', p._thirdPartyId)) return
  const thirdParty = await context.ThirdParty.get(sanitize(p._thirdPartyId))
  if (!thirdParty) {
    context.log.warn(`slots consumed for unknown third party ${sanitize(p._thirdPartyId)}`)
    return
  }
  context.ThirdParty.set({ ...thirdParty, consumedSlots: thirdParty.consumedSlots + p._qty })
  const sender = p._sender.toLowerCase()
  const curation = await context.Curation.get(sender)
  context.Curation.set({ id: sender, qty: (curation?.qty ?? 0n) + p._qty })
  const c = await count(context)
  context.ThirdPartyCount.set({
    ...c,
    curationTotal: c.curationTotal + (curation ? 0n : 1n),
    receiptTotal: c.receiptTotal + 1n,
  })
  context.Receipt.set({
    id: p._messageHash.toLowerCase(),
    qty: p._qty,
    thirdParty_id: thirdParty.id,
    curation_id: sender,
    signer: p._signer.toLowerCase(),
    createdAt: BigInt(event.block.timestamp),
  })
})

indexer.onEvent({ contract: 'ThirdPartyRegistry', event: 'ThirdPartyAggregatorSet' }, async ({ event, context }) => {
  const registry = await context.RegistryData.get('1')
  context.RegistryData.set({ ...registry, id: '1', aggregatorAddress: event.params._newThirdPartyAggregator.toLowerCase() })
})
