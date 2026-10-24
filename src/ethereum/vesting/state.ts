import { toBytes } from '../../common/hex'
import { PausedLog, ReleaseLog, Vesting } from '../../model'
import { VestingEvent } from './events'

/** A vesting contract's fields as the subgraph reads them when the factory creates it. */
export interface VestingFields {
  version: number
  duration: bigint
  cliff: bigint
  beneficiary: string
  revoked: boolean
  revocable: boolean
  released: bigint
  start: bigint
  periodDuration: bigint
  vestedPerPeriod: bigint[]
  paused: boolean
  pausable: boolean
  stop: bigint
  linear: boolean
  token: string
  owner: string
  total: bigint
}

/**
 * Reads a new vesting contract at the block that created it (`./reader`), or answers `undefined` for
 * a contract that is not one it can read.
 */
export interface VestingReader {
  read(vesting: string, block: { height: number; hash: string }): Promise<VestingFields | undefined>
}

/** Wei as the subgraph keeps amounts: whole tokens, rounded down. */
export const tokens = (wei: bigint) => wei / 10n ** 18n

/** The vestings a batch touches, read once, and the logs it adds. */
export class VestingState {
  readonly vestings = new Map<string, Vesting>()
  readonly releaseLogs = new Map<string, ReleaseLog>()
  readonly pausedLogs = new Map<string, PausedLog>()
  /** The contracts the factory created that could not be read as vestings, left out. */
  readonly warnings: string[] = []
  private readonly missing = new Set<string>()

  constructor(private readonly loader: { get(id: string): Promise<Vesting | undefined> }) {}

  async get(id: string): Promise<Vesting | undefined> {
    if (this.vestings.has(id)) return this.vestings.get(id)
    if (this.missing.has(id)) return undefined
    const vesting = await this.loader.get(id)
    if (vesting) this.vestings.set(id, vesting)
    else this.missing.add(id)
    return vesting
  }

  create(vesting: Vesting): void {
    this.missing.delete(vesting.id)
    this.vestings.set(vesting.id, vesting)
  }
}

/**
 * Applies one event as the subgraph's mapping does. Events of a contract no vesting was created for
 * (they are read by topic past the snapshot) are left out.
 */
export async function applyVestingEvent(state: VestingState, ev: VestingEvent, reader: VestingReader): Promise<void> {
  if (ev.kind === 'VestingCreated') {
    const fields = await reader.read(ev.vesting, { height: ev.blockNumber, hash: ev.blockHash })
    if (!fields) {
      state.warnings.push(`${ev.vesting}, created at block ${ev.blockNumber}, cannot be read as a vesting contract: left out`)
      return
    }
    state.create(
      new Vesting({
        ...fields,
        id: ev.vesting,
        beneficiary: toBytes(fields.beneficiary),
        token: toBytes(fields.token),
        owner: toBytes(fields.owner),
        vestedPerPeriod: fields.vestedPerPeriod.map(String),
        revokeTimestamp: null,
      })
    )
    return
  }
  const vesting = await state.get(ev.vesting)
  if (!vesting) return
  switch (ev.kind) {
    // A version 1 contract emits the running total released; the subgraph adds it up all the same.
    case 'ReleasedV1':
    case 'ReleasedV2': {
      const amount = tokens(ev.amount)
      vesting.released += amount
      // One id per vesting and timestamp: a second release in the same block replaces the first.
      const id = `${vesting.id}-${ev.timestamp}`
      state.releaseLogs.set(id, new ReleaseLog({ id, timestamp: ev.timestamp, amount, vesting }))
      return
    }
    case 'Paused':
    case 'Unpaused': {
      vesting.paused = ev.kind === 'Paused'
      const id = `${vesting.id}-${ev.timestamp}-${ev.kind}`
      state.pausedLogs.set(id, new PausedLog({ id, timestamp: ev.timestamp, eventType: ev.kind, vesting }))
      return
    }
    case 'Revoked':
      vesting.revoked = true
      vesting.revokeTimestamp = ev.timestamp
      return
  }
}
