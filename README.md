# registry-squid

A [Subsquid](https://docs.sqd.dev/) indexer for Decentraland's LAND permissions, LAND rentals, the
third-party (linked wearables) registry and the vesting contracts.

| Module | Contracts | Chain |
| --- | --- | --- |
| LAND permissions | LANDRegistry, EstateRegistry | Ethereum |
| Rentals | Rentals, plus `UpdateOperator` of LAND and Estate, the contracts it rents from | Ethereum |
| Third-party registry | ThirdPartyRegistry | Polygon |
| Vestings | Every TokenVesting and PeriodicTokenVesting the vesting factory created | Ethereum |

## Compatibility with the subgraphs

It replaces three subgraphs: [LAND-permissions-graph](https://github.com/decentraland/LAND-permissions-graph),
[rentals-graph](https://github.com/decentraland/rentals-graph) and
[tpr-graph](https://github.com/decentraland/tpr-graph).

- **Same names, fields and id formats.** Entity names, field names and id formats follow those subgraphs. The GraphQL API runs with `--dialect thegraph`, so their queries keep working.
- **Pass `first` and `orderBy`.** graph-node applies `first: 100` and sorts by `id` when a query leaves them out, at the top level and in nested lists. The squid applies neither: a query without `first` returns every row, and rows without `orderBy` come back in no particular order. Queries that already pass both behave the same.
- **Text in the same order.** graph-node sorts and compares text byte by byte (C collation). Every text column here takes the C collation too (`db/migrations/*-TextCollation.js`), so `orderBy: id`, `id_gt` and any order or range over text page exactly as on the subgraph, whatever the database's default collation.
- **Empty strings as each subgraph stores them.** Most of the subgraphs' generated setters store a nullable string set to `""` as `null`, so a third party with an empty name or description searches as `null` (`searchName`, `searchDescription`), and so does a Sepolia LAND or estate whose metadata has an empty name, description or IPNS. The mainnet LAND subgraph is an older deployment whose setters store `""` as given, so there those metadata fields read `""`. The squid stores them the same way on each network.
- **Additive fields.** Fields marked "squid-only" in `schema/` are additions; clients that do not ask for them are unaffected.
- **Renamed fields and entities.** A few names change because a squid cannot express them:
    - `EstateHistory._prevEstateId` is `prevEstateId`, since field names cannot start with `_`.
    - The two subgraphs' `Count` entities are `RentalsCount` and `ThirdPartyCount`, since one squid has one GraphQL namespace.
    - The items of `ThirdPartyMetadata.contracts` are of type `LinkedContract`, not `LinkedContracts`, which matters only to fragments and `__typename`.
- **Vestings as the vestings subgraph reads them.** It also replaces the vestings subgraph governance reads (deployment `QmV6EB6uq5548oCdcjYU3pz1jLwwkSoKUg6DY5dZrAgvTN`, whose source is not published: its schema and mapping were read from IPFS). Its values are kept as it computes them, oddities included: amounts in whole tokens, a version 1 release logged as the running total the contract emits, version 1 totals from a fixed list. `schema/vesting.graphql` lists them. `Vesting.vestedPerPeriod` is a list of strings, as the squid has no BigInt lists; it answers the same JSON.
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
| `v1_vestings` | Every vesting contract the factory created, amounts in whole tokens |
| `v1_vesting_releases` | Every release, one per vesting and timestamp |
| `v1_vesting_pauses` | Every Paused / Unpaused of a vesting |

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
| `RPC_ENDPOINT_ETH` | Ethereum RPC for reading new vesting contracts; the network's public Decentraland RPC by default. It must take a block by hash (EIP-1898) and report a call that reverts as one (code 3, or "revert" in the message), as geth and the default do: version 2 contracts are told apart by `duration()` reverting |

The only RPC calls read each vesting contract once, at the block the factory created it, as the
subgraph does: its parameters are not in any event. Everything else comes from event logs, and LAND
coordinates are decoded from the token id.

The processor reads the vesting contracts it knows by address, from a snapshot of the factory's
contracts (`src/ethereum/vesting/snapshot-<dataset>.json`), and anything past the snapshot's height
by topic, keeping only contracts the factory created. An old snapshot is still correct, only slower
to index past it: past the snapshot every contract emitting those events is read (`Paused` and
`Unpaused` are OpenZeppelin's, so on the SQD portal that is every pausable contract on mainnet), and
each one costs a lookup; on chain-lake only Decentraland's contracts are there. Refresh it before a
reindex: `RPC_ENDPOINT_ETH=<url> npm run vestings:snapshot` refreshes it (`ETHEREUM_CHAIN_ID`
picks the network).

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

The API (`serve:prod` in `commands.json`) shares its database with other services, so it bounds what
one request can take from it: each SQL statement runs for at most 10 seconds, and a request asks for
at most 20 root fields (the Builder's land query, the heaviest client query known, asks for 10). The
two multiply. A request runs one statement per root field, one after another on one connection, so
it can hold that connection for up to 20 × 10 seconds, and nothing stops it when the subgraph proxy
in front of it gives up at 9 seconds and falls back.

It reads each request in a `REPEATABLE READ` transaction, so all of a request's root fields see the
same snapshot, as they do on a subgraph. The server's default, `SERIALIZABLE`, adds nothing for a
read-only request over tables the processors write a whole batch at a time, and Postgres refuses it
on a read replica (a hot standby), which the API reads from in production.

It sets no `--max-response-size`: that limit is checked against an estimate that multiplies
the `first` of every nested list, and the Builder's land query nests lists of 1000 three levels deep
(`authorizations { owner { estates { parcels } } }`), which estimates in the billions of nodes
however few rows it returns.

## License

[MIT](LICENSE)
