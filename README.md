# registry-squid

A [Subsquid](https://docs.sqd.dev/) indexer for Decentraland's LAND permissions, LAND rentals and the
third-party (linked wearables) registry.

| Module | Contracts | Chain |
| --- | --- | --- |
| LAND permissions | LANDRegistry, EstateRegistry | Ethereum |
| Rentals | Rentals, plus `UpdateOperator` of LAND and Estate, the contracts it rents from | Ethereum |
| Third-party registry | ThirdPartyRegistry | Polygon |

## Compatibility with the subgraphs

It replaces three subgraphs: [LAND-permissions-graph](https://github.com/decentraland/LAND-permissions-graph),
[rentals-graph](https://github.com/decentraland/rentals-graph) and
[tpr-graph](https://github.com/decentraland/tpr-graph).

- **Same names, fields and id formats.** Entity names, field names and id formats follow those subgraphs. The GraphQL API runs with `--dialect thegraph`, so their queries keep working.
- **Pass `first` and `orderBy`.** graph-node applies `first: 100` and sorts by `id` when a query leaves them out, at the top level and in nested lists. The squid applies neither: a query without `first` returns every row, and rows without `orderBy` come back in no particular order. Queries that already pass both behave the same.
- **Additive fields.** Fields marked "squid-only" in `schema/` are additions; clients that do not ask for them are unaffected.
- **Renamed fields and entities.** A few names change because a squid cannot express them:
    - `EstateHistory._prevEstateId` is `prevEstateId`, since field names cannot start with `_`.
    - The two subgraphs' `Count` entities are `RentalsCount` and `ThirdPartyCount`, since one squid has one GraphQL namespace.
    - The items of `ThirdPartyMetadata.contracts` are of type `LinkedContract`, not `LinkedContracts`, which matters only to fragments and `__typename`.
- **Lists of references.** `Estate.parcels`, `Data.parcel`, `Data.estate` and `ThirdPartyMetadata.contracts` are derived or stored inline, since a squid cannot store a list of references. They read the same fields; `contracts` is kept sorted by id, as graph-node returns it, and cannot be filtered on.

## History without time travel

Squids cannot answer The Graph's `block: { number }` queries. These additions answer the same questions with plain reads:

- `EstateHistory.estateTokenId`, `blockNumber` and `logIndex`: which estate a parcel belonged to at a block.
- `AuthorizationState`: the current UpdateManager / ApprovalForAll approvals, next to the `Authorization` event log.
- `ThirdPartyRootHistory`: a third party's merkle root and approval after every review.

## SQL views

Services that read the database directly should read the `v1_*` views, not the entity tables:

| View | Contents |
| --- | --- |
| `v1_parcel_rights` | Each parcel's owner and operators, with its estate's |
| `v1_estate_rights` | Each estate's owner, operators and size |
| `v1_land_authorizations_current` | The current UpdateManager / ApprovalForAll approvals |
| `v1_estate_parcels_history` | Every AddLand / RemoveLand |
| `v1_rentals` | Every rental |
| `v1_rental_assets` | Rented assets and whether they were claimed |
| `v1_third_parties` | Third parties with their metadata |
| `v1_third_party_root_history` | Merkle root and approval after every review |

## Running locally

```bash
npm ci
npm run build
export DB_HOST=127.0.0.1 DB_PORT=5432 DB_NAME=registry DB_USER=postgres DB_PASS=postgres
npx squid-typeorm-migration apply
node lib/ethereum/main.js   # LAND permissions and rentals
node lib/polygon/main.js    # third-party registry
GQL_PORT=4350 npx squid-graphql-server --dialect thegraph
```

| Variable | Meaning |
| --- | --- |
| `SQD_PORTAL_URL` | Portal host; defaults to the public `https://portal.sqd.dev` |
| `SQD_PORTAL_API_KEY` | Sent as `x-api-key` when set |
| `ETHEREUM_CHAIN_ID`, `POLYGON_CHAIN_ID` | `1` / `11155111` and `137` / `80002`; mainnet by default |
| `ETHEREUM_STOP_BLOCK`, `POLYGON_STOP_BLOCK` | Stop at a block, for bounded runs and comparisons |
| `ETHEREUM_FROM_BLOCK` | Start later than the contracts' first block, to check one module in isolation (LAND state will be partial) |
| `ETHEREUM_PROMETHEUS_PORT`, `POLYGON_PROMETHEUS_PORT` | Metrics ports; `3000` and `3001` by default |
| `SQUID_SCHEMA` | The deployment schema, used to name each processor's state schema |

The squid makes no RPC calls: LAND coordinates are decoded from the token id, and every other value
comes from event logs.

## Comparing with a subgraph

`lib/tools/compare.js` checks the squid against a live subgraph at one block:

1. Run the processor with `ETHEREUM_STOP_BLOCK=<block>` (or `POLYGON_STOP_BLOCK` for the third-party registry).
2. Start the GraphQL API.
3. Run the comparison:

```bash
ENTITIES=land BLOCK=<block> SUBGRAPH_URL=https://subgraph.decentraland.org/land-manager \
  SQUID_URL=http://localhost:4350/graphql node lib/tools/compare.js
```

`ENTITIES` is `land`, `rentals` or `third-party`. The subgraph side uses `block: { number }`, so
indexing lag cannot cause a difference.

## Tests

```bash
npm test
```

## Deployment

The Docker image runs `entrypoint.sh`. With `SQUID_ENABLED=true` it starts `indexer.sh`, which
gives every (service, commit) pair its own Postgres schema and database user and records it in a
`public.indexers` table: redeploying a commit resumes its schema, while a new commit indexes from
scratch next to the running one. Space-separated `READER_ROLES` are granted read access to each new
schema. Without `SQUID_ENABLED`, the image only serves the GraphQL API, over the schema named by
`DB_SCHEMA` (the promoted one).

## License

[MIT](LICENSE)
