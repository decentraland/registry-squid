/**
 * Compares this squid against one of the subgraphs it replaces, at one block.
 *
 * The squid must have stopped exactly at that block (ETHEREUM_STOP_BLOCK or POLYGON_STOP_BLOCK).
 * The subgraph is queried with `block: { number }`, so indexing lag on either side cannot cause a
 * difference. Ids are walked on the subgraph with an `id_gt` keyset and looked up on the squid with
 * `id_in`, so the two databases never need to agree on string ordering.
 *
 *   ENTITIES=land SUBGRAPH_URL=https://subgraph.decentraland.org/land-manager \
 *   SQUID_URL=http://localhost:4350/graphql BLOCK=7000000 node lib/tools/compare.js
 *
 * ENTITIES is land (land-manager), rentals (rentals-ethereum-mainnet) or third-party
 * (tpr-matic-mainnet). MAX_PAGES caps the pages per entity, for a quick sample.
 */

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || 'https://subgraph.decentraland.org/land-manager'
const SQUID_URL = process.env.SQUID_URL || 'http://localhost:4350/graphql'
const BLOCK = Number(process.env.BLOCK)
const PAGE = 1000
const MAX_PAGES = Number(process.env.MAX_PAGES || 1_000_000)

interface EntitySpec {
  /** The plural query field on the subgraph. */
  field: string
  /** The plural query field on the squid, when the entity was renamed. */
  squidField?: string
  selection: string
}

const SPECS: Record<string, EntitySpec[]> = {
  land: [
    {
      field: 'parcels',
      selection:
        'id tokenId x y owner { id } operator updateOperator updatedAt estate { id } data { id version name description ipns }',
    },
    {
      field: 'estates',
      selection: 'id owner { id } operator updateOperator size createdAt updatedAt data { id version name description ipns }',
    },
    { field: 'authorizations', selection: 'id type tokenAddress owner { id } operator isApproved timestamp createdAt' },
    { field: 'owners', selection: 'id address eventName timestamp createdAt parcel { id } estate { id }' },
    { field: 'operators', selection: 'id address eventName timestamp createdAt parcel { id } estate { id }' },
    { field: 'updateOperators', selection: 'id address eventName timestamp createdAt parcel { id } estate { id }' },
    { field: 'estateHistories', selection: 'id estateId parcel { id } createdAt' },
  ],
  rentals: [
    {
      field: 'rentals',
      selection:
        'id contractAddress tokenId lessor tenant operator rentalDays startedAt endsAt updatedAt pricePerDay sender ownerHasClaimedAsset claimedAt isExtension isActive signature rentalContractAddress',
    },
    { field: 'rentalAssets', selection: 'id contractAddress tokenId lessor isClaimed claimedAt' },
    {
      field: 'indexesUpdateHistories',
      selection:
        'id type date sender contractUpdate { id newIndex contractAddress } singerUpdate { id newIndex signer } assetUpdate { id newIndex signer tokenId contractAddress type }',
    },
    { field: 'rentables', selection: 'id' },
    { field: 'rentalsContracts', selection: 'id fee' },
    { field: 'analyticsDayDatas', selection: 'id date rentals volume lessorEarnings feeCollectorEarnings' },
    { field: 'analyticsTotalDatas', selection: 'id rentals volume lessorEarnings feeCollectorEarnings' },
    { field: 'counts', squidField: 'rentalsCounts', selection: 'id value' },
  ],
  'third-party': [
    {
      field: 'thirdParties',
      selection:
        'id managers rawMetadata resolver isApproved maxItems root consumedSlots isProgrammatic searchName searchDescription searchText metadata { id type thirdParty { id name description contracts { id network address } } }',
    },
    { field: 'receipts', selection: 'id qty signer createdAt curation { id } thirdParty { id }' },
    { field: 'curations', selection: 'id qty' },
    { field: 'registryDatas', selection: 'id aggregatorAddress' },
    { field: 'metadata_collection', selection: 'id type thirdParty { id }' },
    { field: 'thirdPartyMetadata_collection', selection: 'id name description contracts { id network address }' },
    { field: 'linkedContracts_collection', selection: 'id network address' },
    { field: 'counts', squidField: 'thirdPartyCounts', selection: 'id thirdPartyTotal receiptTotal curationTotal' },
  ],
}

async function gql(url: string, query: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const body: any = await res.json().catch(() => ({}))
    if (res.ok && !body.errors) return body.data
    if (attempt >= 5) throw new Error(`${url}: ${res.status} ${JSON.stringify(body.errors ?? body).slice(0, 500)}`)
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
  }
}

/** Sorts keys and lowercases hex so both sides print the same JSON for the same value. */
function normalize(value: any): any {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalize(value[k])]))
  }
  if (typeof value === 'string' && value.startsWith('0x')) return value.toLowerCase()
  if (typeof value === 'number') return String(value)
  return value
}

async function compareEntity(spec: EntitySpec): Promise<{ checked: number; differences: string[]; ids: Set<string> }> {
  const differences: string[] = []
  const ids = new Set<string>()
  let checked = 0
  let lastId = ''
  for (let page = 0; page < MAX_PAGES; page++) {
    const where = lastId ? `where: { id_gt: ${JSON.stringify(lastId)} }, ` : ''
    const subgraph = await gql(
      SUBGRAPH_URL,
      `{ rows: ${spec.field}(${where}first: ${PAGE}, orderBy: id, orderDirection: asc, block: { number: ${BLOCK} }) { ${spec.selection} } }`
    )
    const rows: any[] = subgraph.rows
    if (rows.length === 0) break
    lastId = rows[rows.length - 1].id

    const pageIds = JSON.stringify(rows.map((r) => r.id))
    const squidField = spec.squidField ?? spec.field
    const squid = await gql(SQUID_URL, `{ rows: ${squidField}(where: { id_in: ${pageIds} }, first: ${PAGE}) { ${spec.selection} } }`)
    const byId = new Map<string, any>(squid.rows.map((r: any) => [r.id, r]))

    for (const row of rows) {
      checked++
      ids.add(row.id)
      const mine = byId.get(row.id)
      if (!mine) {
        differences.push(`${spec.field} ${row.id}: missing in squid`)
        continue
      }
      const a = JSON.stringify(normalize(row))
      const b = JSON.stringify(normalize(mine))
      if (a !== b) differences.push(`${spec.field} ${row.id}:\n  subgraph ${a}\n  squid    ${b}`)
    }
    if (rows.length < PAGE) break
  }
  return { checked, differences, ids }
}

/** Ids the squid has and the subgraph does not, walked with the same keyset as the subgraph side. */
async function squidOnlyIds(spec: EntitySpec, subgraphIds: Set<string>): Promise<string[]> {
  const extra: string[] = []
  let lastId = ''
  for (;;) {
    const where = lastId ? `where: { id_gt: ${JSON.stringify(lastId)} }, ` : ''
    const data = await gql(SQUID_URL, `{ rows: ${spec.squidField ?? spec.field}(${where}first: ${PAGE}, orderBy: id) { id } }`)
    const rows: { id: string }[] = data.rows
    for (const row of rows) if (!subgraphIds.has(row.id)) extra.push(row.id)
    if (rows.length < PAGE) break
    lastId = rows[rows.length - 1].id
  }
  return extra
}

async function main() {
  if (!Number.isInteger(BLOCK)) throw new Error('BLOCK is required')
  if (!Number.isInteger(MAX_PAGES) || MAX_PAGES < 1) throw new Error('MAX_PAGES must be a positive integer')
  let failures = 0
  const specs = SPECS[process.env.ENTITIES || 'land']
  if (!specs) throw new Error(`ENTITIES must be one of ${Object.keys(SPECS).join(', ')}`)
  const complete = !process.env.MAX_PAGES
  for (const spec of specs) {
    const { checked, differences, ids } = await compareEntity(spec)
    // Only a complete walk of the subgraph can tell which squid rows it lacks.
    const extra = complete ? await squidOnlyIds(spec, ids) : []
    console.log(`${spec.field}: ${checked} checked, ${differences.length} different, ${extra.length} only in squid`)
    for (const d of differences.slice(0, 10)) console.log(d)
    for (const id of extra.slice(0, 10)) console.log(`${spec.field} ${id}: only in squid`)
    failures += differences.length + extra.length
  }
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
