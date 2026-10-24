// Versioned read views of the vesting tables, as the ones in Views: services that read the database
// directly read these, never the tables. Amounts are whole tokens, as the subgraph keeps them.
const HEX = (column) => `'0x' || encode(${column}, 'hex')`

const VIEWS = {
  // Every vesting contract the factory created, as it was read at its creation and changed since.
  v1_vestings: `
    SELECT v.id, v.version, ${HEX('v.token')} AS token, ${HEX('v.owner')} AS owner, ${HEX('v.beneficiary')} AS beneficiary,
           v.start, v.cliff, v.duration, v.period_duration, v.vested_per_period, v.total, v.released,
           v.revocable, v.revoked, v.revoke_timestamp, v.pausable, v.paused, v.stop, v.linear
      FROM vesting v`,

  // Every release, one per vesting and timestamp.
  v1_vesting_releases: `
    SELECT r.id, r.vesting_id, r.timestamp, r.amount
      FROM release_log r`,

  // Every Paused / Unpaused.
  v1_vesting_pauses: `
    SELECT p.id, p.vesting_id, p.timestamp, p.event_type
      FROM paused_log p`,
}

module.exports = class VestingViews1792837192457 {
  name = 'VestingViews1792837192457'

  async up(db) {
    for (const [name, sql] of Object.entries(VIEWS)) {
      await db.query(`CREATE VIEW "${name}" AS ${sql}`)
    }
  }

  async down(db) {
    for (const name of Object.keys(VIEWS).reverse()) {
      await db.query(`DROP VIEW "${name}"`)
    }
  }
}
