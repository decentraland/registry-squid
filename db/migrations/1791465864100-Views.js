// Versioned read views: the SQL contract for services that read this squid's database directly.
//
// Consumers read these views, never the entity tables, so the tables can change between squid
// versions without breaking them. A breaking change ships as v2_* next to v1_*. The views live in
// the squid's own schema, so a promotion that renames the schema carries them along. Addresses are
// lowercase 0x-prefixed text; token ids are numeric.
//
// Migrations run in timestamp order. A regenerated table migration gets a newer timestamp than this
// file, so the views would be created before their tables: drop the views first in that migration,
// or move the views into a new migration timestamped after it.
const HEX = (column) => `'0x' || encode(${column}, 'hex')`

const VIEWS = {
  // Current owner and operators of every parcel, with its estate's when it belongs to one.
  v1_parcel_rights: `
    SELECT p.id AS parcel_id, p.token_id, p.x, p.y,
           p.owner_id AS owner, ${HEX('p.operator')} AS operator, ${HEX('p.update_operator')} AS update_operator,
           p.estate_id, e.owner_id AS estate_owner, ${HEX('e.operator')} AS estate_operator,
           ${HEX('e.update_operator')} AS estate_update_operator, p.updated_at
      FROM parcel p
      LEFT JOIN estate e ON e.id = p.estate_id`,

  v1_estate_rights: `
    SELECT e.id AS estate_id, e.owner_id AS owner, ${HEX('e.operator')} AS operator,
           ${HEX('e.update_operator')} AS update_operator, e.size, e.created_at, e.updated_at
      FROM estate e`,

  // The latest UpdateManager / ApprovalForAll per (token contract, owner, operator, type).
  v1_land_authorizations_current: `
    SELECT ${HEX('a.token_address')} AS token_address, a.owner_id AS owner, ${HEX('a.operator')} AS operator,
           a.type, a.is_approved, a.block_number, a.log_index
      FROM authorization_state a`,

  // Every AddLand / RemoveLand. The estate of a parcel at block N is the latest row for that parcel
  // with block_number <= N, when it is an AddLand.
  v1_estate_parcels_history: `
    SELECT h.parcel_id, h.estate_token_id AS estate_id, h.event_name, h.block_number, h.log_index, h.created_at
      FROM estate_history h`,

  v1_rentals: `
    SELECT r.id, r.contract_address, r.token_id, r.lessor, r.tenant, r.operator, r.rental_days, r.price_per_day,
           r.started_at, r.ends_at, r.updated_at, r.is_active, r.is_extension, r.owner_has_claimed_asset,
           r.claimed_at, r.signature, r.rental_contract_address, r.block_number
      FROM rental r`,

  v1_rental_assets: `
    SELECT ${HEX('a.contract_address')} AS contract_address, a.token_id, ${HEX('a.lessor')} AS lessor,
           a.is_claimed, a.claimed_at
      FROM rental_asset a`,

  v1_third_parties: `
    SELECT t.id, t.managers, t.resolver, t.is_approved, t.root, t.max_items, t.consumed_slots, t.is_programmatic,
           m.name, m.description, m.contracts
      FROM third_party t
      LEFT JOIN third_party_metadata m ON m.id = t.id`,

  // Root and approval after every review. The root in force at block N is the latest row for the
  // third party with block_number <= N.
  v1_third_party_root_history: `
    SELECT h.third_party_id, h.root, h.is_approved, h.event_name, h.block_number, h.log_index, h.timestamp
      FROM third_party_root_history h`,
}

module.exports = class Views1791465864100 {
  name = 'Views1791465864100'

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
