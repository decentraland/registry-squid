import { DataSourceBuilder } from '@subsquid/evm-stream'
import { RpcClient } from '@subsquid/rpc-client'
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
import { getVestingNetwork } from './vesting/config'
import { decodeVestingLog, VESTING_TOPICS, VestingEvent } from './vesting/events'
import { createVestingReader } from './vesting/reader'
import { vestingLogRequests } from './vesting/subscriptions'
import { applyVestingEvent, VestingState } from './vesting/state'
import { Vesting } from '../model'

const logger = createLogger('sqd:ethereum')
const contracts = getEthereumContracts()
const vestings = getVestingNetwork()
const from = getStartBlock() ?? contracts.landStartBlock

// Vesting contracts are read once, at the block the factory creates them, over RPC: the portal only
// has logs. The public RPC of the network unless RPC_ENDPOINT_ETH says otherwise.
const vestingReader = createVestingReader(
  vestings,
  // A batch fails if one read does, and is retried from scratch: rate limits and timeouts are retried
  // here instead, for as long as they last, as the portal's are. A request that hangs times out, so it
  // is retried rather than holding the batch; the client logs each retry.
  new RpcClient({
    url: process.env.RPC_ENDPOINT_ETH || vestings.rpc,
    capacity: 20,
    rateLimit: 20,
    requestTimeout: 30_000,
    retryAttempts: Number.MAX_SAFE_INTEGER,
    retrySchedule: [1000, 2000, 5000, 10000, 30000],
  })
)

const builder = new DataSourceBuilder()
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
for (const request of vestingLogRequests(vestings, from)) builder.addLog(request)
const dataSource = builder.build()

// SQUID_SCHEMA, never DB_SCHEMA: promotion renames the deployment schema, and a search_path pinned
// from the environment would go stale the moment it does.
const schema = process.env.SQUID_SCHEMA || 'local'
const db = new TypeormDatabase({
  isolationLevel: 'READ COMMITTED',
  // Index the unfinalized tip and roll it back on reorgs, so permission changes show up seconds
  // after the transaction instead of after Ethereum finality (~13 minutes).
  supportHotBlocks: true,
  // indexer.sh creates this schema, readable by READER_ROLES: keep the two names in step.
  stateSchema: `ethereum_processor_${schema}`,
})

const prometheus = new PrometheusServer()
prometheus.setPort(Number(process.env.ETHEREUM_PROMETHEUS_PORT || 3000))

type Item = { land?: LandEvent; rentals?: RentalsEvent; vesting?: VestingEvent }

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
const OTHER_CONTRACTS = new Set([contracts.landRegistry, contracts.estateRegistry, contracts.rentals])

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
        // Vesting events share their signatures with other contracts' (Rentals is pausable too): only
        // logs of the factory, or of contracts other than the ones above, are vesting events.
        const address = lower(log.address)
        if (address === vestings.factory || (VESTING_TOPICS.includes(log.topics[0]) && !OTHER_CONTRACTS.has(address))) {
          const vesting = decodeVestingLog(
            raw,
            {
              blockNumber: block.header.number,
              blockHash: block.header.hash,
              timestamp: BigInt(Math.floor(block.header.timestamp / 1000)),
            },
            vestings
          )
          if (vesting) items.push({ vesting })
          continue
        }
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
    const land = await loadLandState(ctx.store, landEvents, contracts.estateRegistry, contracts.emptyMetadataReadsNull)
    const rentals = new RentalsState(storeLoader(ctx.store))
    const vestingState = new VestingState({ get: (id) => ctx.store.get(Vesting, id) })
    for (const item of items) {
      if (item.land) applyLandEvent(land, item.land)
      if (item.rentals) await applyRentalsEvent(rentals, item.rentals)
      if (item.vesting) await applyVestingEvent(vestingState, item.vesting, vestingReader)
    }

    await saveLandState(ctx.store, land)
    for (const cls of SAVE_ORDER) await ctx.store.upsert(rentals.entitiesToSave(cls))
    await ctx.store.upsert([...vestingState.vestings.values()])
    await ctx.store.upsert([...vestingState.releaseLogs.values()])
    await ctx.store.upsert([...vestingState.pausedLogs.values()])

    for (const warning of land.warnings) logger.warn(warning)
    for (const error of rentals.errors) logger.warn(error)
    for (const warning of vestingState.warnings) logger.warn(warning)
    const first = ctx.blocks[0].header.number
    const last = ctx.blocks[ctx.blocks.length - 1].header.number
    logger.info(
      `blocks ${first}-${last}: ${items.length} events, ${land.touchedParcels.size} parcels, ` +
        `${land.touchedEstates.size} estates, ${land.authorizations.length} authorizations`
    )
  },
  { prometheus }
)
