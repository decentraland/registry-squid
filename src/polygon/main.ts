import { DataSourceBuilder } from '@subsquid/evm-stream'
import { PrometheusServer, run } from '@subsquid/batch-processor'
import { Store, TypeormDatabase } from '@subsquid/typeorm-store'
import { createLogger } from '@subsquid/logger'
import { portalSource } from '../common/portal'
import { Loader } from '../common/lazy-state'
import { getPolygonContracts, getStopBlock } from './config'
import { decodeThirdPartyLog, THIRD_PARTY_TOPICS } from './third-party/events'
import { applyThirdPartyEvent, SAVE_ORDER, ThirdPartyState } from './third-party/state'

const logger = createLogger('sqd:polygon')
const contracts = getPolygonContracts()

const dataSource = new DataSourceBuilder()
  .setPortal(portalSource(contracts.dataset))
  .setBlockRange({ from: contracts.thirdPartyRegistryStartBlock, to: getStopBlock() })
  .setFields({
    block: { timestamp: true },
    log: { address: true, topics: true, data: true, transactionHash: true },
  })
  .addLog({ where: { address: [contracts.thirdPartyRegistry], topic0: THIRD_PARTY_TOPICS } })
  .build()

const schema = process.env.SQUID_SCHEMA || 'local'
const db = new TypeormDatabase({
  isolationLevel: 'READ COMMITTED',
  supportHotBlocks: true,
  // indexer.sh creates this schema, readable by READER_ROLES: keep the two names in step.
  stateSchema: `polygon_processor_${schema}`,
})

const prometheus = new PrometheusServer()
prometheus.setPort(Number(process.env.POLYGON_PROMETHEUS_PORT || 3001))

function storeLoader(store: Store): Loader {
  return { get: (cls, id) => store.get(cls, id) }
}

run(
  dataSource,
  db,
  async (ctx) => {
    const state = new ThirdPartyState(storeLoader(ctx.store))
    let events = 0
    for (const block of ctx.blocks) {
      const logs = [...block.logs].sort((a, b) => a.logIndex - b.logIndex)
      for (const log of logs) {
        const ev = decodeThirdPartyLog(log, {
          blockNumber: block.header.number,
          timestamp: BigInt(Math.floor(block.header.timestamp / 1000)),
          logIndex: log.logIndex,
          transactionHash: log.transactionHash,
          address: contracts.thirdPartyRegistry,
        })
        if (!ev) continue
        await applyThirdPartyEvent(state, ev)
        events++
      }
    }
    if (events === 0) return
    for (const cls of SAVE_ORDER) await ctx.store.upsert(state.entitiesToSave(cls))
    for (const error of state.errors) logger.warn(error)
    logger.info(`blocks ${ctx.blocks[0].header.number}-${ctx.blocks[ctx.blocks.length - 1].header.number}: ${events} events`)
  },
  { prometheus }
)
