# registry-squid on Envio HyperIndex

A port of this squid to [Envio HyperIndex](https://docs.envio.dev). It indexes the same four
modules into the same entities, with the same names, fields and id formats:

| Module | Contracts | Chain | Handlers |
| --- | --- | --- | --- |
| LAND permissions | LANDRegistry, EstateRegistry | Ethereum | `src/handlers/land.ts` |
| Rentals | Rentals, plus `UpdateOperator` of LAND and Estate | Ethereum | `src/handlers/rentals.ts` |
| Vestings | VestingFactory and every vesting contract it creates | Ethereum | `src/handlers/vesting.ts` |
| Third-party registry | ThirdPartyRegistry | Polygon | `src/handlers/thirdParty.ts` |

The squid code is untouched. This project lives beside it in `envio/` and shares nothing with it
at build or run time.

## Running it

Requirements: Node 22+, pnpm, Docker, and an Envio API token for HyperSync
(<https://envio.dev/app/api-tokens>).

```bash
cd envio
cp .env.example .env        # set ENVIO_API_TOKEN
pnpm install
pnpm codegen                # generates types from config.yaml and schema.graphql
pnpm test                   # unit tests, plus real-block tests (need the token and an RPC)
pnpm dev                    # Postgres + Hasura in Docker, then indexes both chains
```

`pnpm dev` serves GraphQL at <http://localhost:8080/v1/graphql> (Hasura). To use an existing
Postgres instead, run `pnpm start` with `ENVIO_PG_HOST`, `ENVIO_PG_PORT`, `ENVIO_PG_USER`,
`ENVIO_PG_PASSWORD` and `ENVIO_PG_DATABASE` set; `ENVIO_HASURA=false` skips the GraphQL server.

| Variable | Meaning |
| --- | --- |
| `ENVIO_API_TOKEN` | HyperSync token (required) |
| `ENVIO_RPC_ENDPOINT_ETH` | Ethereum archive RPC for the vesting reads. Defaults to `https://rpc.decentraland.org/mainnet`, the squid's default |

## How the squid maps to HyperIndex

| Squid | HyperIndex |
| --- | --- |
| Three processors (`ethereum`, `polygon`, `vesting`), each with its own state schema | One indexer with two chains, in `config.yaml` |
| SQD portal, filtered by address and topic | HyperSync, filtered by the contracts and events in `config.yaml` |
| `schema/*.graphql`, TypeORM models and migrations | `schema.graphql` and `pnpm codegen`; tables are created on start |
| Batch handlers that prefetch entities (`land/persist.ts`, `common/lazy-state.ts`) | One handler per event using `context.<Entity>.get/set`; HyperIndex batches and prefetches the reads |
| Vesting address snapshot (`snapshot-*.json`) plus a topic-wide scan past it | `contractRegister` on `VestingCreated`: each new vesting is indexed from the block that created it, so no snapshot or topic-wide scan is needed |
| `src/vesting/reader.ts` (RPC reads at creation) | An Effect (`readVesting`) with the same version detection, retries and "not a vesting" rule; results are cached |
| `supportHotBlocks: true` | Reorg handling is on by default |
| `--dialect thegraph` GraphQL server | Hasura GraphQL (see "API differences") |

Each handler is a line-by-line port of the squid's `state.ts` files, including every subgraph
quirk the squid reproduces: CSV parsing, empty strings, manager order, NUL characters, and the
vestings subgraph's whole-token amounts. The pure helpers (`decodeTokenId`, `parseCSV`, ...) are
copied into `src/common/`, with the squid's own tests in `test/lib.test.ts`.

### Entity and field differences

These are forced by HyperIndex's schema rules. The values are the same.

- **`ThirdPartyMetadata.contracts`** is a JSON column holding the same sorted
  `[{ id, network, address }]` list, since HyperIndex has no embedded object types. Clients read
  `contracts` instead of `contracts { id network address }`.
- **`Data.parcel` and `Data.estate`** are stored references rather than `@derivedFrom`, since a
  HyperIndex `@derivedFrom` is always a list. They point to the same parcel or estate, as in the
  LAND subgraph, which also stores them.
- **`@unique`** on `Parcel.data` and `Estate.data` is dropped (HyperIndex has no such directive).
  Each Data row belongs to one parcel or estate by construction, since its id is theirs.
- Every table has a `chainId` column; rows are keyed by `(id, chainId)`. Each entity is written by
  one chain only, so ids keep the squid's formats with no chain prefix.

### API differences

HyperIndex serves GraphQL through Hasura, not graph-node's dialect. Entity and field names are the
same, but queries take a different shape, for example
`Parcel(where: {owner_id: {_eq: "0x..."}}, limit: 100, order_by: {id: asc})` rather than
`parcels(where: {owner: "0x..."}, first: 100, orderBy: id)`. Clients of the squid's
`--dialect thegraph` API would need their queries rewritten, or a translation layer in front.
Services that read Postgres directly would need the `v1_*` views recreated over these tables
(not done here). The API's statement timeout and root-field limit are not ported either.

## Benchmark

Full backfill from each contract's first block to chain head on one machine (Apple Silicon laptop,
Postgres 17 in Docker), 29 October 2026.

| | HyperIndex (HyperSync) | Squid (public SQD portal, no API key) |
| --- | --- | --- |
| Ethereum: LAND, estates, rentals, vestings (blocks 4,944,642 → 26,298,953, 529,912 events) | **3 min 22 s** (measured; 5 min 24 s on a second run sharing the machine with the squid) | ~11 h for LAND/rentals, ~20 h for vestings (**extrapolated** from a 90-minute run) |
| Polygon: third-party registry (blocks 26,860,700 → 96,385,483, 252 events) | under 35 s (measured, sampled), in the same run | ~40 h (**extrapolated**) |
| Both chains to head | **3 min 22 s**, plus 4 s to build indexes | ~40 h (**extrapolated**) |

How it was measured:

- HyperIndex: `envio start` against an empty database, timed from process start to the
  `ready_at` the indexer records when every chain has finished backfilling. The vesting reads
  (818 contracts) went to the public Decentraland RPC, rate-limited to 10 reads per second.
- Squid: the three processors (`lib/ethereum`, `lib/polygon`, `lib/vesting`) started together
  against an empty database and stopped after 90 minutes. In that time they reached 13.2%, 3.3%
  and 7.4% of their block ranges. The portal answered HTTP 529 (throttled) about 1,300 times; the
  processors' block rate stayed flat throughout, so the extrapolation is the remaining blocks at
  the last 30 minutes' rate. Another squid was backfilling from the same machine at the time. This
  measures the public portal, not a self-hosted one; a squid reading its own portal would be
  faster, and was not measured.

## Correctness

At the indexed head (Ethereum block 26,298,953, Polygon block 96,385,483), every row of every
entity the squid's `src/tools/compare.ts` checks, plus `Wallet`, was compared with Decentraland's
live subgraphs (`land-manager`, `rentals-ethereum-mainnet`, `tpr-matic-mainnet`) using
`block: { number }` queries: 1,236,528 rows across 24 entities, **0 differences, none missing,
none extra**. The 818 vesting contracts were checked against their own on-chain state at the same
block (token, start, revocable, revoked; for version 2 also paused, linear, pausable, period,
vested per period and released): **0 differences**.

The events processed (529,912 on Ethereum, 252 on Polygon) equal the raw log counts for the same
contracts, events and block ranges queried independently from HyperSync. Up to Ethereum block
7,753,234, where the squid run stopped, the squid and this port wrote the same number of `Owner`
rows (177,760).
