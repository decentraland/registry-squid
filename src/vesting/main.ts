import { DataSourceBuilder } from '@subsquid/evm-stream'
import { PrometheusServer, run } from '@subsquid/batch-processor'
import { TypeormDatabase } from '@subsquid/typeorm-store'
import { createLogger } from '@subsquid/logger'
import { portalSource } from '../common/portal'
import { getStartBlock, getStopBlock } from '../ethereum/config'
import { Vesting } from '../model'
import { getVestingNetwork } from './config'
import { decodeVestingLog, VestingEvent } from './events'
import { createVestingReader, VestingRpcClient } from './reader'
import { vestingLogRequests } from './subscriptions'
import { applyVestingEvent, VestingState } from './state'

/**
 * The vesting contracts, in a processor of their own. Anyone can create a contract with the factory,
 * and each one is read over RPC: whatever such a contract makes fail stops this processor alone, not
 * LAND, estates and rentals, which keep indexing in the Ethereum one.
 */
const logger = createLogger('sqd:vesting')
const vestings = getVestingNetwork()
const from = getStartBlock() ?? vestings.factoryStartBlock

// Vesting contracts are read once, at the block the factory creates them, over RPC: the portal only
// has logs. The public RPC of the network unless RPC_ENDPOINT_ETH says otherwise.
const vestingReader = createVestingReader(
  vestings,
  // A batch fails if one read does, and is retried from scratch: rate limits and timeouts are retried
  // here instead, for as long as they last, as the portal's are. A request that hangs times out, so it
  // is retried rather than holding the batch; the client logs each retry.
  new VestingRpcClient({
    url: process.env.RPC_ENDPOINT_ETH || vestings.rpc,
    capacity: 20,
    rateLimit: 20,
    requestTimeout: 30_000,
    retryAttempts: Number.MAX_SAFE_INTEGER,
    retrySchedule: [1000, 2000, 5000, 10000, 30000],
  })
)

const builder = new DataSourceBuilder()
  .setPortal(portalSource(vestings.dataset))
  .setBlockRange({ from, to: getStopBlock() })
  .setFields({
    block: { timestamp: true },
    log: { address: true, topics: true, data: true },
  })
for (const request of vestingLogRequests(vestings, from)) builder.addLog(request)
const dataSource = builder.build()

// SQUID_SCHEMA, never DB_SCHEMA: promotion renames the deployment schema, and a search_path pinned
// from the environment would go stale the moment it does.
const schema = process.env.SQUID_SCHEMA || 'local'
const db = new TypeormDatabase({
  isolationLevel: 'READ COMMITTED',
  supportHotBlocks: true,
  // indexer.sh creates this schema, readable by READER_ROLES: keep the two names in step.
  stateSchema: `vesting_processor_${schema}`,
})

const prometheus = new PrometheusServer()
prometheus.setPort(Number(process.env.VESTING_PROMETHEUS_PORT || 3002))

/**
 * The ids of the vestings in the store (about a thousand rows), read once, and every one created
 * since (VestingState adds them). A vesting created in a block a reorg drops stays in it, which only
 * costs a store lookup.
 */
let knownVestings: Set<string> | undefined

run(
  dataSource,
  db,
  async (ctx) => {
    const events: VestingEvent[] = []
    for (const block of ctx.blocks) {
      const meta = {
        blockNumber: block.header.number,
        blockHash: block.header.hash,
        timestamp: BigInt(Math.floor(block.header.timestamp / 1000)),
      }
      // Past the snapshot, any contract's logs with a vesting event's topic come (Rentals' Paused, say):
      // VestingState keeps only those of contracts the factory created.
      for (const log of [...block.logs].sort((a, b) => a.logIndex - b.logIndex)) {
        const ev = decodeVestingLog(log, meta, vestings)
        if (ev) events.push(ev)
      }
    }
    if (events.length === 0) return

    knownVestings ??= new Set((await ctx.store.find(Vesting, {})).map((v) => v.id))
    const state = new VestingState({ get: (id) => ctx.store.get(Vesting, id) }, knownVestings)
    for (const ev of events) await applyVestingEvent(state, ev, vestingReader)

    await ctx.store.upsert([...state.vestings.values()])
    await ctx.store.upsert([...state.releaseLogs.values()])
    await ctx.store.upsert([...state.pausedLogs.values()])

    for (const warning of state.warnings) logger.warn(warning)
    const first = ctx.blocks[0].header.number
    const last = ctx.blocks[ctx.blocks.length - 1].header.number
    logger.info(`blocks ${first}-${last}: ${events.length} events, ${state.vestings.size} vestings`)
  },
  { prometheus }
)
