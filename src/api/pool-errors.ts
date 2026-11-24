import type { EventEmitter } from 'node:events'
import { createLogger } from '@subsquid/logger'

/**
 * Loaded before the GraphQL API starts (`node --require=./lib/api/pool-errors.js`, see `commands.json`).
 *
 * `@subsquid/graphql-server` creates its `pg.Pool` without an `error` listener and keeps idle connections
 * open. When the database ends one of them (an engine upgrade, a restart, a failover,
 * `pg_terminate_backend`), the pool re-emits the error, and an `error` event nobody listens to ends the
 * process. With a listener the pool only drops the dead connection and opens another for the next query.
 * Errors on a connection that is running a query still reach that query.
 */

type PoolClass = new (...args: any[]) => EventEmitter

const log = createLogger('sqd:api:pool')
const pg: { Pool: PoolClass } = require('pg')
const Pool = pg.Pool

pg.Pool = class extends Pool {
  constructor(...args: any[]) {
    super(...args)
    this.on('error', (err: Error & { code?: string }) => {
      log.warn({ code: err.code, reason: err.message }, 'the database ended an idle connection; the pool opens another one for the next query')
    })
  }
}
