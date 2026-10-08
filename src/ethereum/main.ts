import { DataSourceBuilder } from '@subsquid/evm-stream'
import { PrometheusServer, run } from '@subsquid/batch-processor'
import { Store, TypeormDatabase } from '@subsquid/typeorm-store'
import { createLogger } from '@subsquid/logger'
import { portalSource } from '../common/portal'
import { lower } from '../common/hex'
import { getEthereumContracts, getStartBlock, getStopBlock } from './config'
import { decodeLandLog, ESTATE_TOPICS, EventMeta, LAND_TOPICS, LandEvent } from './land/events'
import { applyLandEvent } from './land/state'
import { loadLandState, saveLandState } from './land/persist'
import { decodeRentalsLog, RENTALS_TOPICS, RentalsEvent } from './rentals/events'
import { applyRentalsEvent, RentalsLoader, RentalsState, SAVE_ORDER } from './rentals/state'

const logger = createLogger('sqd:ethereum')
const contracts = getEthereumContracts()
const from = getStartBlock() ?? contracts.landStartBlock

const dataSource = new DataSourceBuilder()
  .setPortal(portalSource(contracts.dataset))
  .setBlockRange({ from, to: getStopBlock() })
  .setFields({
    block: { timestamp: true },
    log: { address: true, topics: true, data: true, transactionHash: true },
    transaction: { to: true },
  })
  .addLog({
    where: { address: [contracts.landRegistry], topic0: LAND_TOPICS },
    range: { from: Math.max(from, contracts.landStartBlock) },
  })
  .addLog({
    where: { address: [contracts.estateRegistry], topic0: ESTATE_TOPICS },
    range: { from: Math.max(from, contracts.estateStartBlock) },
  })
  .addLog({
    where: { address: [contracts.rentals], topic0: RENTALS_TOPICS },
    include: { transaction: true },
    range: { from: Math.max(from, contracts.rentalsStartBlock) },
  })
  .build()

// SQUID_SCHEMA, never DB_SCHEMA: promotion renames the deployment schema, and a search_path pinned
// from the environment would go stale the moment it does.
const schema = process.env.SQUID_SCHEMA || 'local'
const db = new TypeormDatabase({
  isolationLevel: 'READ COMMITTED',
  // Index the unfinalized tip and roll it back on reorgs, so permission changes show up seconds
  // after the transaction instead of after Ethereum finality (~13 minutes).
  supportHotBlocks: true,
  stateSchema: `ethereum_processor_${schema}`,
})

const prometheus = new PrometheusServer()
prometheus.setPort(Number(process.env.ETHEREUM_PROMETHEUS_PORT || 3000))

type Item = { land?: LandEvent; rentals?: RentalsEvent }

/**
 * The rentals subgraph listens to UpdateOperator of the contracts it rents from. Only LAND and
 * Estate are followed here; a rental of any other contract is logged, since its operator updates
 * would be missed.
 */
function rentableUpdate(ev: LandEvent): RentalsEvent | undefined {
  if (ev.kind !== 'ParcelUpdateOperator' && ev.kind !== 'EstateUpdateOperator') return undefined
  if (ev.blockNumber < contracts.rentalsStartBlock) return undefined
  return { ...ev, kind: 'RentableUpdateOperator', contractAddress: ev.address, tokenId: ev.tokenId, operator: ev.operator }
}

const RENTABLE_CONTRACTS = new Set([contracts.landRegistry, contracts.estateRegistry])

function storeLoader(store: Store): RentalsLoader {
  return { get: (cls, id) => store.get(cls, id) }
}

run(
  dataSource,
  db,
  async (ctx) => {
    const items: Item[] = []
    for (const block of ctx.blocks) {
      const transactionTo = new Map<number, string | null>()
      for (const tx of block.transactions) transactionTo.set(tx.transactionIndex, tx.to ?? null)

      const logs = [...block.logs].sort((a, b) => a.logIndex - b.logIndex)
      for (const log of logs) {
        const raw = {
          address: log.address,
          topics: log.topics,
          data: log.data,
          logIndex: log.logIndex,
          transactionHash: log.transactionHash,
        }
        const blockInfo = { number: block.header.number, timestampMs: block.header.timestamp }
        if (lower(log.address) === contracts.rentals) {
          const meta: EventMeta = {
            blockNumber: block.header.number,
            timestamp: BigInt(Math.floor(block.header.timestamp / 1000)),
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            address: contracts.rentals,
          }
          const rentals = decodeRentalsLog(raw, meta, transactionTo.get(log.transactionIndex) ?? null)
          if (rentals?.kind === 'AssetRented' && !RENTABLE_CONTRACTS.has(rentals.contractAddress)) {
            logger.warn(`asset rented from an untracked contract ${rentals.contractAddress} at block ${meta.blockNumber}`)
          }
          if (rentals) items.push({ rentals })
          continue
        }
        const land = decodeLandLog(raw, blockInfo, contracts)
        if (land) items.push({ land, rentals: rentableUpdate(land) })
      }
    }
    if (items.length === 0) return

    const landEvents = items.flatMap((i) => (i.land ? [i.land] : []))
    const land = await loadLandState(ctx.store, landEvents, contracts.estateRegistry)
    const rentals = new RentalsState(storeLoader(ctx.store))
    for (const item of items) {
      if (item.land) applyLandEvent(land, item.land)
      if (item.rentals) await applyRentalsEvent(rentals, item.rentals)
    }

    await saveLandState(ctx.store, land)
    for (const cls of SAVE_ORDER) await ctx.store.upsert(rentals.entitiesToSave(cls))

    for (const warning of land.warnings) logger.warn(warning)
    for (const error of rentals.errors) logger.warn(error)
    const first = ctx.blocks[0].header.number
    const last = ctx.blocks[ctx.blocks.length - 1].header.number
    logger.info(
      `blocks ${first}-${last}: ${items.length} events, ${land.touchedParcels.size} parcels, ` +
        `${land.touchedEstates.size} estates, ${land.authorizations.length} authorizations`
    )
  },
  { prometheus }
)
